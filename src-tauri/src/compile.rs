//! Thin wrapper around the tectonic engine, shared by the Tauri command
//! (`compile_tex`) and the desktop `prewarm` binary.

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};

use tectonic::status::{MessageKind, StatusBackend};

const DOC_NAME: &str = "document.tex";
const PDF_NAME: &str = "document.pdf";
const LOG_NAME: &str = "document.log";

/// 串行化引擎调用：stdout 捕获是进程级状态。
static ENGINE_LOCK: Mutex<()> = Mutex::new(());

pub struct CompileOutput {
    pub pdf: Vec<u8>,
    pub log: String,
}

/// 实时日志回调：`(kind, line)`。kind ∈ `"tex"|"note"|"warning"|"error"`，
/// `"tex"` 是引擎终端转写（fd 捕获），其余是 tectonic 自身的状态消息。
pub type LogSink = dyn Fn(&str, &str) + Send + Sync;

/// 不需要实时日志的调用方（e2e 测试、prewarm）共用的空 sink。
pub fn noop_sink() -> Arc<LogSink> {
    Arc::new(|_, _| {})
}

/// Point tectonic (and its `directories`-based path resolution) at app-private
/// dirs. Must be called once before any engine use — done in the Tauri setup
/// hook, single-threaded. `set_var` is unsafe as of edition 2024.
pub fn set_engine_env(cache_dir: &Path, home_dir: &Path) {
    unsafe {
        std::env::set_var("TECTONIC_CACHE_DIR", cache_dir);
        std::env::set_var("XDG_CACHE_HOME", home_dir);
        std::env::set_var("HOME", home_dir);
        // Keeps \today / \time deterministic across devices.
        std::env::set_var("TZ", "UTC0");
    }
}

/// Compile `source` (the main document, in memory) inside `job_root`.
/// `extra_files` are additional project files (`\input`, graphics) written
/// into `job_root` before the run.
///
/// The engine is wrapped in `catch_unwind`: tectonic unwraps internally in
/// several places (e.g. cache misses while offline), and a panic crossing the
/// async-command/FFI boundary would abort the whole process.
pub fn compile(
    source: &str,
    job_root: &Path,
    extra_files: &[(String, Vec<u8>)],
    sink: &Arc<LogSink>,
) -> Result<CompileOutput, String> {
    // 引擎运行期间会重定向进程级 fd1（见 capture），两个编译并发会互相
    // 抢 stdout，恢复顺序错乱后还可能把 fd1 指到已关闭的管道。这里把
    // 「一次只有一个编译」编码进结构，而不是依赖 UI 禁用按钮。
    let _guard = ENGINE_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    prepare_job_root(job_root, extra_files)?;

    let source = source.to_string();
    let job_root = job_root.to_path_buf();
    let sink = Arc::clone(sink);
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        run_engine(&source, &job_root, &sink)
    })) {
        Ok(result) => result,
        Err(payload) => Err(format!("引擎内部 panic：{}", panic_message(&*payload))),
    }
}

/// Fresh job dir per run: tectonic writes outputs and reads \input files here.
fn prepare_job_root(job_root: &Path, extra_files: &[(String, Vec<u8>)]) -> Result<(), String> {
    if job_root.exists() {
        fs::remove_dir_all(job_root)
            .map_err(|e| format!("无法清理任务目录 {}：{e}", job_root.display()))?;
    }
    fs::create_dir_all(job_root)
        .map_err(|e| format!("无法创建任务目录 {}：{e}", job_root.display()))?;
    for (name, data) in extra_files {
        let path = job_root.join(clean_rel_path(name)?);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("无法创建子目录：{e}"))?;
        }
        fs::write(&path, data).map_err(|e| format!("无法写入文件 {name}：{e}"))?;
    }
    Ok(())
}

/// `catch_unwind` 的 payload 只有两种常见类型：`&str` 与 `String`。
fn panic_message(payload: &(dyn std::any::Any + Send)) -> String {
    payload
        .downcast_ref::<String>()
        .cloned()
        .or_else(|| payload.downcast_ref::<&str>().map(|s| s.to_string()))
        .unwrap_or_else(|| "未知 panic".to_string())
}

/// Reject absolute paths and `..` components in user-provided file names.
fn clean_rel_path(name: &str) -> Result<PathBuf, String> {
    let p = Path::new(name);
    if p.is_absolute() {
        return Err(format!("非法路径（不允许绝对路径）：{name}"));
    }
    let mut out = PathBuf::new();
    for comp in p.components() {
        match comp {
            Component::Normal(c) => out.push(c),
            Component::CurDir => {}
            _ => return Err(format!("非法路径（不允许 `..` 等成分）：{name}")),
        }
    }
    Ok(out)
}

fn run_engine(source: &str, job_root: &Path, sink: &Arc<LogSink>) -> Result<CompileOutput, String> {
    let config = tectonic::config::PersistentConfig::open(false)
        .map_err(|e| format!("无法打开 tectonic 配置：{e}"))?;
    // only_cached = false: prefer the local (prewarmed) cache; missing files
    // fall back to the network bundle.
    let bundle = config
        .default_bundle(false)
        .map_err(|e| format!("无法加载宏包 bundle：{e}"))?;
    let format_cache = config
        .format_cache_path()
        .map_err(|e| format!("无法定位 format 缓存：{e}"))?;

    let mut builder = tectonic::driver::ProcessingSessionBuilder::default();
    builder
        .bundle(bundle)
        .format_cache_path(&format_cache)
        .primary_input_buffer(source.as_bytes())
        .tex_input_name(DOC_NAME)
        .format_name("latex")
        .output_format(tectonic::driver::OutputFormat::Pdf)
        .output_dir(job_root)
        .filesystem_root(job_root)
        .keep_logs(true)
        .keep_intermediates(false)
        // 引擎终端转写写 stdout（编译期间被 fd 捕获），tectonic 自身消息走 SinkStatus
        .print_stdout(true);

    let mut status = SinkStatus(sink);
    let mut session = builder
        .create(&mut status)
        .map_err(|e| format!("无法创建编译会话：{e}"))?;
    // 仅引擎运行期间把进程 stdout 重定向进管道，转写逐行推给 sink
    let _capture =
        capture::StdoutCapture::start(sink).map_err(|e| format!("无法捕获引擎输出：{e}"))?;
    session.run(&mut status).map_err(|e| {
        // 失败路径 tectonic 仍会写出 document.log（driver 的 write_files(only_logs)），
        // 把它随错误串带回前端，供日志面板展示 `! LaTeX Error:` 等详情。
        // marker 与 src/lib/compileLog.ts 的 COMPILE_LOG_MARKER 保持一致。
        let log = fs::read_to_string(job_root.join(LOG_NAME)).unwrap_or_default();
        if log.is_empty() {
            format!("编译失败：{e}")
        } else {
            format!("编译失败：{e}\n<<<TECTONIC_LOG>>>\n{log}")
        }
    })?;
    drop(_capture); // 尽早恢复进程 stdout

    let pdf = fs::read(job_root.join(PDF_NAME)).map_err(|e| format!("未找到 PDF 输出：{e}"))?;
    let log = fs::read_to_string(job_root.join(LOG_NAME)).unwrap_or_default();
    Ok(CompileOutput { pdf, log })
}

/// 把 tectonic 自身的状态消息转发给实时日志回调。
struct SinkStatus<'a>(&'a Arc<LogSink>);

impl StatusBackend for SinkStatus<'_> {
    fn report(
        &mut self,
        kind: MessageKind,
        args: std::fmt::Arguments,
        err: Option<&anyhow::Error>,
    ) {
        let mut line = format!("{args}");
        if let Some(e) = err {
            line.push_str(&format!("：{e}"));
        }
        let k = match kind {
            MessageKind::Note => "note",
            MessageKind::Warning => "warning",
            MessageKind::Error => "error",
        };
        (self.0)(k, &line);
    }

    fn dump_error_logs(&mut self, output: &[u8]) {
        for line in String::from_utf8_lossy(output).lines() {
            (self.0)("error", line);
        }
    }
}

/// 实时日志捕获。unix 实现：编译期间把 fd1 重定向到管道，drain 线程逐行转发；
/// Drop 恢复 stdout 并关闭写端触发 EOF。panic 经 catch_unwind 也走 Drop，不会泄漏重定向。
#[cfg(unix)]
mod capture {
    use std::fs::File;
    use std::io::{BufRead, BufReader, Write};
    use std::os::unix::io::FromRawFd;
    use std::sync::Arc;
    use std::thread;

    use super::LogSink;

    pub(super) struct StdoutCapture {
        saved_fd: libc::c_int,
        write_fd: libc::c_int,
    }

    impl StdoutCapture {
        pub(super) fn start(sink: &Arc<LogSink>) -> std::io::Result<Self> {
            let mut fds = [-1 as libc::c_int; 2]; // [read, write]
            if unsafe { libc::pipe(fds.as_mut_ptr()) } != 0 {
                return Err(std::io::Error::last_os_error());
            }
            let saved_fd = unsafe { libc::dup(libc::STDOUT_FILENO) };
            if saved_fd < 0 {
                let err = std::io::Error::last_os_error();
                unsafe {
                    libc::close(fds[0]);
                    libc::close(fds[1]);
                }
                return Err(err);
            }
            if unsafe { libc::dup2(fds[1], libc::STDOUT_FILENO) } < 0 {
                let err = std::io::Error::last_os_error();
                unsafe {
                    libc::close(saved_fd);
                    libc::close(fds[0]);
                    libc::close(fds[1]);
                }
                return Err(err);
            }

            // 读端交给 drain 线程；写端 = fd1 + fds[1]，两者都关闭后读端 EOF 收尾。
            let reader = unsafe { BufReader::new(File::from_raw_fd(fds[0])) };
            let sink = Arc::clone(sink);
            thread::spawn(move || {
                let mut reader = reader;
                let mut buf = String::new();
                loop {
                    buf.clear();
                    match reader.read_line(&mut buf) {
                        Ok(0) | Err(_) => break,
                        Ok(_) => sink("tex", buf.trim_end_matches(&['\n', '\r'][..])),
                    }
                }
            });

            Ok(Self {
                saved_fd,
                write_fd: fds[1],
            })
        }
    }

    impl Drop for StdoutCapture {
        fn drop(&mut self) {
            // fd1 仍指向管道时冲掉 Rust stdout 的行缓冲残留，再恢复原 stdout
            let _ = std::io::stdout().flush();
            unsafe {
                libc::dup2(self.saved_fd, libc::STDOUT_FILENO);
                libc::close(self.saved_fd);
                libc::close(self.write_fd);
            }
        }
    }
}

/// 非 unix 平台的空实现：项目目标平台为桌面 Linux 与 Android（均为 unix）。
#[cfg(not(unix))]
mod capture {
    use std::sync::Arc;

    use super::LogSink;

    pub(super) struct StdoutCapture;

    impl StdoutCapture {
        pub(super) fn start(_sink: &Arc<LogSink>) -> std::io::Result<Self> {
            Ok(Self)
        }
    }

    impl Drop for StdoutCapture {
        fn drop(&mut self) {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_job(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("base6-compile-{name}-{}", std::process::id()))
    }

    #[test]
    fn clean_rel_path_accepts_nested_relative_names() {
        assert_eq!(clean_rel_path("a/b.tex").unwrap(), PathBuf::from("a/b.tex"));
        assert_eq!(clean_rel_path("./a").unwrap(), PathBuf::from("a"));
    }

    #[test]
    fn clean_rel_path_rejects_absolute_and_parent_components() {
        assert!(clean_rel_path("/etc/passwd").is_err());
        assert!(clean_rel_path("a/../b").is_err());
        assert!(clean_rel_path("..").is_err());
    }

    #[test]
    fn prepare_job_root_recreates_dir_and_writes_extra_files() {
        let dir = temp_job("prepare");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("stale.tex"), "old").unwrap();

        prepare_job_root(&dir, &[("sub/input.tex".into(), b"new".to_vec())]).unwrap();

        assert!(!dir.join("stale.tex").exists());
        assert_eq!(fs::read(dir.join("sub/input.tex")).unwrap(), b"new");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn prepare_job_root_rejects_escaping_extra_file_names() {
        let dir = temp_job("escape");
        let err = prepare_job_root(&dir, &[("../escape.tex".into(), Vec::new())]).unwrap_err();
        assert!(err.contains("非法路径"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn panic_message_reads_str_and_string_payloads() {
        let owned: Box<dyn std::any::Any + Send> = Box::new(String::from("boom"));
        let borrowed: Box<dyn std::any::Any + Send> = Box::new("bang");
        let other: Box<dyn std::any::Any + Send> = Box::new(42_u32);
        assert_eq!(panic_message(&*owned), "boom");
        assert_eq!(panic_message(&*borrowed), "bang");
        assert_eq!(panic_message(&*other), "未知 panic");
    }
}
