//! 模板共用的输入校验：格式串长度与星期表头。

/// 格式串会原样写进 LaTeX 源，限制长度避免异常文件放大编译开销。
pub(crate) const MAX_TEXT_CHARS: usize = 128;
/// 单个星期表头是表格列标题，过长的值必然溢出。
pub(crate) const MAX_WEEKDAY_HEADER_CHARS: usize = 16;

pub(crate) fn check_text_len(label: &str, text: &str) -> Result<(), String> {
    if text.chars().count() > MAX_TEXT_CHARS {
        return Err(format!("{label}最多 {MAX_TEXT_CHARS} 个字符"));
    }
    Ok(())
}

/// 星期表头必须是英文逗号分隔的 7 个非空短字符串。
pub(crate) fn validate_weekday_headers(headers: &str) -> Result<(), String> {
    let items = weekday_headers(headers);
    if items.len() != 7 || items.iter().any(|item| item.is_empty()) {
        return Err("星期表头必须是 7 个逗号分隔的非空值".into());
    }
    if items
        .iter()
        .any(|item| item.chars().count() > MAX_WEEKDAY_HEADER_CHARS)
    {
        return Err(format!(
            "每个星期表头最多 {MAX_WEEKDAY_HEADER_CHARS} 个字符"
        ));
    }
    Ok(())
}

/// 调用前须通过 `validate_weekday_headers`；保留逗号拆分与去空白语义。
pub(crate) fn weekday_headers(headers: &str) -> Vec<&str> {
    headers.split(',').map(str::trim).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_wrong_header_count_or_empty_items() {
        assert!(validate_weekday_headers("一,二,三,四,五,六,日").is_ok());
        assert!(validate_weekday_headers("一,二,三").is_err());
        assert!(validate_weekday_headers("一,二,三,四,五,六,").is_err());
        assert!(validate_weekday_headers("一,二,三,四,五,六,  ").is_err());
    }

    #[test]
    fn rejects_oversized_text() {
        assert_eq!(
            check_text_len("格式", &"x".repeat(MAX_TEXT_CHARS + 1)).unwrap_err(),
            format!("格式最多 {MAX_TEXT_CHARS} 个字符")
        );
        let long = format!(
            "{},二,三,四,五,六,日",
            "月".repeat(MAX_WEEKDAY_HEADER_CHARS + 1)
        );
        assert_eq!(
            validate_weekday_headers(&long).unwrap_err(),
            format!("每个星期表头最多 {MAX_WEEKDAY_HEADER_CHARS} 个字符")
        );
    }
}
