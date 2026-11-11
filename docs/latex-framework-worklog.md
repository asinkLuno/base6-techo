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

## 骑马订与锁线分帖扩展

1. 阅读当前框架、前端协议和 master 的 impose 实现，确认按整本阅读序列分帖，不以 section 为边界。当前工作区存在用户在途前端改动，本次只处理后端、测试和说明文档。
2. 先增加五项拼版行为测试；运行确认因缺失 imposition 模块和配置而失败，再实现三种模式、纸张正反面元数据、水平放置和尾部补白。
3. 骑马订整本补齐到 4 的倍数；锁线按固定每帖纸张数补齐，默认每帖 4 张。装订方向与拼版方式分开建模，右装订仅交换印刷面的两半。
4. 测试发现 serde 的内部标签 unit 变体会忽略额外字段，改用空 struct 变体以严格拒绝模式不适用的字段，保持 JSON mode 形状不变。
5. LaTeX 输出读取独立的 OutputPlan，整张阅读页只做水平平移；原阅读页布局不重算，补白不调用任何绘制组件。旧横线本 API 默认不拼版。
6. 增加每页恰好出现一次、最大页数、最小/最大帖大小、跨 section 和双向装订的边界测试；增加真实编译三种印刷 PDF 的端到端测试和 Ghostscript 实际位置检查。
7. 全部 20 项单元/框架测试及 3 项端到端测试通过，端到端共编译 5 份 PDF（原阅读页、旧横线本和三种拼版）。Ghostscript 验证三种拼版的 4/8/4 个实际 PDF 面、左右页码、空白无装饰、两侧水印与 296×210mm 纸面；目检锁线第一张正面 [8,1]，正确。
8. 框架 Clippy -D warnings 通过，crapper 的复杂度检查最高 CC 为 9（未测覆盖率 CRAP），dryer 0.8 阈值未发现重复候选。
9. 初轮 40 个拼版变异点检出 38 个；一个幸存者仅改变 Vec 容量，不影响行为，移除该无须保留的容量优化；另一个提示阅读输出帖数缺少断言，补充公开元数据断言，并补上显式 sheetsPerSignature JSON 往返检查。
10. 复查后当前 39 个有效拼版变异点全部检出，无幸存者；同源码纯 Rust 测试与严格 Clippy 均通过。保留 build/imposition-metrics 下的指标，清理本次生成的 mutation-workers 和 Python 字节码，不删除用户前端在途改动。
11. 更新接口说明，记录 mode、每帖纸张数、实际 PDF 纸面尺寸、正反面顺序与双面打印设置。本次本地提交只包含后端、相关测试/检查脚本与文档；仓库未配置 remote，无法推送。
12. 复查 diff 时发现用户也在更新 document_framework.rs 中的前端负载测试；将本次六项拼版测试移到独立 tests/imposition.rs，只提交独立测试文件，保留该文件中的用户改动。临时测试 harness 同步加载两个集成测试文件。

## 方眼罫（Midori）模板

1. 阅读 archive 分支的 `hogen_grid.rs`、`docs/layouts.md` 与 showcase 数据，确认样式为 5mm 方格：横线连续，竖线在每条横线上方留 1mm 断口；隔一条格线向页缘外伸 1.2mm；每 10 格在页缘画标记点；线宽 0.7pt，几何固定、只开放线色。
2. 旧实现按左上角索引计算偶数列/行与每 10 格标记，标记点不居中且会漏掉一侧；本次改为与 `linear`/`dots`/`grid` 一致的中心对称模型：`centered_extent` 增加 `inset` 参数，先预留 1mm 断口 + 1.2mm 外伸，再以页心中心向两侧取整格。
3. 先写后端行为测试（A5 默认页心的格线范围、pattern 相位、四个标记点、外伸短线数量与非法颜色），确认因缺少 `Hogen` 失败；前端 store 测试同样先失败。
4. 实现 `HogenPattern`（仅 `color`）、固定几何常量、`HogenLattice` 与 `hogen_extends`；格线区域用 PGF pattern 一次填充，外伸线与标记点逐页输出。`Canvas` 新增 `hogen_grid` 与 `line`，短线仍走局部坐标。
5. 前端接入 `hogen` 类型、默认值、clamp、模板下拉、颜色控件与中英词条；顺手抽出 `ColorField` 和 `useBodyPatch`，消掉三组模板配置组件的重复样板。Rust 侧把横线/方格相同的校验合并为 `validate_line_grid`。
6. 验证：`cargo test` 全部通过（含把方眼罫加入真实 Tectonic 编译的六页 e2e），`cargo clippy --all-targets -- -D warnings` 通过；`yarn test` 116 项通过，`tsc --noEmit` 与 `biome check .` 通过。栅格化 e2e 文档第 6 页目检，格线、断口、外伸与标记点符合复刻目标。
7. 指标：`crapper --no-coverage` 改动函数 CC 均为 1–较小值；`dryer --threshold 0.8` 仅剩 `LinearPattern`/`GridPattern` 两个结构相同的 7 行 `Default` 实现（不同 serde 类型与默认数值，合并会牺牲类型或改写 JSON 形状），未强行抽象；其余重复已消除。

## 美式横线（linear 左侧竖线）

1. 对照 archive 分支的 `us_ruled.rs` 与 `docs/layouts.md`：美式横线本就是横线版式加一条左侧红竖线，竖线距纸张左缘 `margin_x`（默认 25mm）、0.4pt，原实现横线也通整页宽。按需求改为复用 `linear`，横线仍保持页心宽度，只新增可选左侧竖线。
2. `LinearPattern` 增加 `marginLine: Option<MarginLine>`（`xMm`/`color`/`widthPt`，默认 25mm/`#D96A6A`/0.4pt）；省略或 `null` 关闭。边界校验位置 0–1000mm、线宽 0.01–10pt、颜色 `#RRGGBB`。
3. 竖线必须绕过页心裁剪才能贯穿页头页脚，因此 `BodyTemplate` 新增 `draw_page_overlay`，由 `render_page` 在页心 `clip` 结束后、装饰绘制前调用；它仍处于阅读页纸张裁剪和拼版水平平移之内。
4. 前端新增 `MarginLine` 类型、默认值、clamp、模板配置里的开关与位置/颜色/宽度控件，以及中英词条；旧持久化数据缺少字段时按 `null` 处理。
5. 验证：Rust 新增满页高度与非法参数测试，全部 `cargo test` 通过（含真实 Tectonic e2e）；`yarn test` 117 项通过，`tsc --noEmit` 与 `biome check .` 通过。

## 八分周视图（octanWeek）

1. 对照 archive 分支的 `src-tauri/src/backend/octan_week.rs`：一周拆两页、每页四格，第一页左上格放当月与次月迷你月历；archive 还依赖农历、节假日 ICS 与系统时区。当前主线没有这些数据源，本次只移植周视图核心：整周日期、迷你月历、本周高亮、近似月相与可配置线型/颜色。
2. 先写 `tests/octan_week.rs`：两页覆盖顺序、空白格月历、日期格式与星期语言、点划线/中心留白、非整周拒绝、页数必须等于周数 × 2。首次运行因 `unknown variant 'octanWeek'` 失败，再补实现。
3. 新增 `calendar.rs`：用 Howard Hinnant 的 `days_from_civil` 做纯整数日期运算，避免引入 chrono；实现模板需要的 strftime 子集 `%Y/%m/%-m/%d/%-d/%a/%%` 与 `zh/en/ja` 星期短名。
4. 新增 `octan_week.rs`：`OctanWeekPattern` 校验整周范围、格式串、7 项星期表头、颜色与数值范围；`required_pages() = 周数 × 2`，`document.rs` 在计划阶段拒绝页数不符的文档，让非法状态无法进入渲染。
5. `Canvas` 新增 `line_styled`、`circle`、`filled_path`；实线仍沿用原有输出格式，保证方眼罫与横线测试逐字节不变。`BodyTemplate::draw` 增加 `PageContext`，模板据节内页序选择周与象限。
6. 前端补齐类型、默认值、clamp、日期助手、模板下拉与配置组；八分周视图的页数由周数自动推导，手工改页数被忽略，切换回其他模板时保留当前页数。持久化迁移与配置导入同样按日期范围重算页数。
7. 验证：`cargo test` 全部通过（新增 7 项 octan 集成测试与 1 项真实 Tectonic 编译）；`cargo clippy --all-targets -- -D warnings` 通过；`yarn test` 148 项通过，`tsc --noEmit` 与 `biome check .` 通过。栅格化 `build/octan-preview-*.png` 目检两周四页：日期顺序、迷你月历高亮、点划线与月相均正确。

## 月历（month）

1. 对照 archive 分支 `backend/month.rs`：月历模板还包含农历、节假日 ICS、单/双页拆列与打卡表。主线没有农历与节假日数据源，这次只移植单页核心：月份网格、日期、标题与可选逐日月相；双页、农历、节假日、Tracker/MonthTracker 明确不搬。
2. 先抽共享领域层，行为不变：月相数学从 `octan_week.rs` 移到 `moon.rs`；星期表头校验与文本长度限制移到 `common.rs`；`calendar.rs` 新增 `MonthGrid`（天数、1 号星期偏移、周行数、日号→行列），八分周迷你月历改用同一套网格。
3. 新增 `tests/month.rs`：月份逐页推进、6 月 1 日网格坐标、表头/标题数量、月相开关、页数必须等于月数、非法月份/月数/格式/表头/颜色。先运行确认 `unknown variant 'month'`，再补实现。
4. `month.rs` 采用 archive 的单页版式：页心内容横放后逆时针旋转 90°，左侧留 1/8 页宽标题带；竖线按行、横线按列分段，交叉处留 0.2mm 缺口；每天右上角按月相数学画圆盘与亮面路径。`required_pages() = months`，`document.rs` 通用化为（必需页数, 提示）在计划阶段拒绝页数不符。
5. 前端新增 `MonthPattern`、默认值、`isIsoMonth`/`addMonths`/`monthOf`/`monthPages`/`clampMonth`；`startMonth` 用月份输入框，`months` 1–120，接近 9999 年时自动收敛月数。页数由月份数推导，手工改页数被忽略；写入、迁移与配置导入共用 `pagesFor`。
6. 验证：`cargo test` 全部通过（新增 6 项 month 集成测试与 1 项真实 Tectonic 编译）；`cargo clippy --all-targets -- -D warnings` 通过；`yarn test` 157 项通过，`tsc --noEmit` 与 `biome check .` 通过。栅格化 `build/month-sample.pdf` 目检 2026 年 6–8 月：日期列位置、标题竖排、网格缺口与月相均正确。

## 月打卡（tracker）

1. 对照 archive 分支 `backend/month.rs` 的 `TrackerPattern` 与 `draw_tracker`：单月两段式打卡表，上表 1–14 日带打卡项列，下表 15–月末，两表左缘用折线箭头按打卡项连接；整页横放后逆时针旋转 90°。年度追踪（`month-tracker`）是另一套跨月网格，未纳入本次范围。
2. 先回答复用问题：打卡表与月历共享的是**格线画法与旋转映射**，不是月历的 7 列周网格。抽出 `templates/table.rs`：`Landscape` 负责设计坐标到页面坐标的 90° 映射，`TableGrid` 负责「竖线不过表头、横线不封顶、交叉处留 0.2mm 缺口」的开口表格；月历改用同一原语，输出逐字节不变。
3. `calendar.rs` 新增 `MonthSpan`（`YYYY-MM` 解析、1–120 月数、跨 9999 年边界）与 `parse_month`，月历与月打卡共用同一套月份边界；`MonthGrid` 继续提供当月天数。
4. 新增 `tests/tracker.rs`：月份逐页推进、8 月两表格线 296 条与 4 条箭头、1 号旋转后坐标、打卡项数控制箭头数、页数必须等于月数、非法月份/月数/项数/颜色。运行通过后再补前端。
5. `tracker.rs` 采用 archive 的版式常量：打卡项列宽 5 格、两表间距 2mm、整体上移 3mm、左侧箭头泳道 6mm；`Canvas` 新增 `arrow_path`，箭头沿用 TikZ 默认 0.4pt 线宽。`required_pages() = months`，文档计划阶段拒绝页数不符。
6. 前端新增 `TrackerPattern`、默认值、`newTracker`、`trackerPages`、`clampTracker`，与月历共用 `clampMonthSpan`/`monthSpanPages`；模板下拉、页数只读与 `TrackerFields` 配置组接入，中英词条同步。
7. 验证：`cargo test` 全部通过（新增 5 项 tracker 集成测试与 1 项真实 Tectonic 编译）；`cargo clippy --all-targets -- -D warnings` 通过；`yarn test` 163 项通过，`tsc --noEmit` 与 `biome check .` 通过。栅格化 `build/tracker-sample.pdf` 目检 2026 年 7–8 月：两表行数、日期位置、箭头方向与旋转方向均正确。
