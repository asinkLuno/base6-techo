# LaTeX 框架实施记录

## 目标与术语

- 全书实际页序：从 1 开始连续计数，唯一决定装订侧；跨 section 不重置，隐藏显示页码也照常计数。
- 节内索引：从 0 开始，仅供页心模板决定内容。
- 显示页码：只有参与编号的 section 消耗编号；与实际页序独立。
- 页心：扣除页头、页脚、装订侧、外侧留白后的区域。
- 拼版：将阅读顺序重排到印刷纸张，本次框架不负责拼版。

## 操作记录

1. 阅读 ub-mode、现有模板、IPC、编译器和端到端测试；保留原横线本调用兼容入口，避免影响前端在途改动。
2. 对照远端 master 的 backend.rs；把全书编排、布局、页心模板和装饰绘制分开，避免重建单体后端。
3. 检查 crapper、dryer、mutator 的可用性和用法；计划先写跨 section、隐藏页码、左右装订、区域边界和真实 PDF 的行为测试。

4. 先新增 document_framework 集成测试，覆盖跨节实际页序、隐藏页码、右侧装订镜像、区域边界、非法输入和 JSON 默认值；运行测试确认新模块缺失时失败。
5. 实现 document/layout/components/patterns/latex 模块：全书页序唯一决定装订侧，显示页码独立累计，各区域独立裁剪。
6. 将旧 lined API 改为兼容适配器，保留旧 IPC 与二进制响应格式；新增 generate_document_pdf 共用编译链路。
7. 运行原横线本和新增五页混合文档的 Tectonic 编译，均成功；栅格化并目检实际第 4、5 页，确认左右镜像、区域和页码正确。
8. 使用 Ghostscript 提取 PDF 文字与坐标，验证实际 5 页、前三页无页码、后两页为 1/2、每页两侧水印镜像及 LaTeX 特殊字符原样保留；将检查保存为 scripts/check-framework-sample.py。
9. 增补精确 999 页与 1mm 页心边界、非有限输入、布局中心和横线范围测试。12 项单元/框架测试通过。
10. crapper 初查发现文字转义分支较多，改为一张转义表；dryer 在 0.8 阈值未发现重复候选。环境未安装 Rust 覆盖率工具，复杂度检查使用 --no-coverage，不宣称测得 CRAP 覆盖率分数。
11. mutator 初次隔离运行重新构建整套原生依赖，停止该运行；改用单 worker 和现有 Cargo target 缓存，并使用 --mutate-all 重新检查，防止沿用中止运行的结果。
12. 文档说明 JSON/IPC 协议、页序与坐标约定、模板扩展方式和当前全书共享配置的范围；README 增加文档入口。
13. 最终采用 build/ 下的临时纯 Rust harness（仅 serde/serde_json，直接加载相同源码与测试）完成变异测试；document/layout/patterns 共 42 个变异点全部被测试检出，无幸存者。未使用覆盖率筛选，该结果只对应所选变异点。
14. 最终 13 项单元/框架测试、2 项 Tectonic PDF 编译测试、Ghostscript PDF 检查全部通过。框架及测试的 Clippy -D warnings 通过；整个后端的同项检查受既有 cache.rs:60 collapsible_if 警告阻挡，未修改该无关文件。
15. 保留 build/framework-sample.pdf、.tex、页面 PNG 和指标报告以便复查；确认所有变异测试进程结束后，移走根目录指标并删除本次创建的 mutation-workers 临时树，保留实际项目 target 缓存。
16. 仓库没有配置 git remote，无法执行 ub-mode 的最终 push；只创建本地提交，不擅自把用户用于参考的 GitHub 地址设置为推送目标。
17. 本地实现提交 `6fce584`：框架、兼容接口、IPC 与验证脚本；随后单独提交说明文档和本日志，便于分别审阅。
