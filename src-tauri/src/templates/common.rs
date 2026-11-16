//! 模板共用的输入校验：格式串长度。

/// 格式串会原样写进 LaTeX 源，限制长度避免异常文件放大编译开销。
pub(crate) const MAX_TEXT_CHARS: usize = 128;

pub(crate) fn check_text_len(label: &str, text: &str) -> Result<(), String> {
    if text.chars().count() > MAX_TEXT_CHARS {
        return Err(format!("{label}最多 {MAX_TEXT_CHARS} 个字符"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_oversized_text() {
        assert_eq!(
            check_text_len("格式", &"x".repeat(MAX_TEXT_CHARS + 1)).unwrap_err(),
            format!("格式最多 {MAX_TEXT_CHARS} 个字符")
        );
    }
}
