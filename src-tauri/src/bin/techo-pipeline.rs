//! CLI 入口：stdin 收 JSON（RunPipelineRequest），校验后生成 PDF 并写入 output。
//!
//! 用法：`techo-pipeline < request.json`
//! 成功时 stdout 输出 PDF 路径（退出码 0）；失败时 stderr 输出错误（退出码 1）。

use std::io::Read;

fn main() {
    let mut input = String::new();
    std::io::stdin()
        .read_to_string(&mut input)
        .expect("failed to read stdin");
    let body: base6_techo_lib::RunPipelineRequest = match serde_json::from_str(&input) {
        Ok(body) => body,
        Err(e) => {
            eprintln!("invalid JSON: {e}");
            std::process::exit(1);
        }
    };
    match base6_techo_lib::generate_pipeline(body) {
        Ok(path) => println!("{}", path.display()),
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(1);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_field() {
        let r = serde_json::from_str::<base6_techo_lib::RunPipelineRequest>(
            r#"{"output":"/tmp/x.pdf","sections":[],"extra":1}"#,
        );
        assert!(r.is_err(), "deny_unknown_fields 应拒绝多余字段");
    }

    #[test]
    fn rejects_empty_sections() {
        let body: base6_techo_lib::RunPipelineRequest =
            serde_json::from_str(r#"{"output":"/tmp/x.pdf","sections":[]}"#).unwrap();
        assert!(base6_techo_lib::generate_pipeline(body).is_err());
    }
}
