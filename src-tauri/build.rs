use std::{env, process::Command};

fn main() {
    println!("cargo:rerun-if-env-changed=PYO3_PYTHON");
    println!("cargo:rerun-if-env-changed=VIRTUAL_ENV");

    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("linux")
        && env::var("PROFILE").as_deref() == Ok("debug")
    {
        let python = env::var_os("PYO3_PYTHON").or_else(|| {
            env::var_os("VIRTUAL_ENV").map(|venv| {
                std::path::PathBuf::from(venv)
                    .join("bin/python3")
                    .into_os_string()
            })
        });

        if let Some(python) = python {
            if let Ok(output) = Command::new(python)
                .args([
                    "-c",
                    "import sysconfig; print(sysconfig.get_config_var('LIBDIR') or '')",
                ])
                .output()
            {
                let libdir = String::from_utf8_lossy(&output.stdout).trim().to_owned();
                if output.status.success() && !libdir.is_empty() {
                    println!("cargo:rustc-link-arg=-Wl,-rpath,{libdir}");
                }
            }
        }
    }

    tauri_build::build()
}
