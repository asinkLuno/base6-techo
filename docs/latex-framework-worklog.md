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

## 一日时间轴（daily）

1. 对照 archive 分支 `backend/daily_timeline.rs` 与 `docs/layouts.md`：纵向时间轴排在装订侧，整点号与日期标题在外侧，15/30/60 分钟三档刻度，刻度向外画点线到页缘；可选按经纬度、时区与太阳高度角昼夜着色。旧实现按页高缩放并取整字号、两页拆分随左右装订页序反转、超过 24 点的整点号直接印成 25–30，点线逐点输出。
2. 新增 `templates/daily.rs`：`DailyPattern`（日期范围、起止整点、每日页数、线色/线宽、整点号字号、标题格式、星期语言、可选 `SunWindow`）与校验；`required_pages() = 天数 × 每日页数`，页数上限 999，一天两页时要求时间跨度至少 2 小时。
3. 修正旧实现的三处问题：字号改为显式 pt（标题固定为整点号的 1.5 倍），不再随页高缩放取整；两页拆分按节内页序的前/后半天推进，与左右装订无关；整点号超过 24 时减去 24 显示（25→01、30→06）。点线新增 `Canvas::line_dotted_batch`，用 TikZ `dash pattern` 画到页缘，替代逐点输出；同色点线共用一个 scope，线宽与点距只声明一次，每条线仍单独 `\draw` 以保证点列从行首重新起算。
4. 太阳高度角按 NOAA 公式用纯 `f64` 实现，时区改为数值 `utcOffsetHours`，与项目不引入 chrono/chrono-tz 的既有决定一致；只有昼夜两色，不做晨昏渐变。
5. 先写 `tests/daily.rs`：日期逐页推进、整点号 00–24、两页拆分阅读顺序、跨午夜整点号回绕、昼夜两色同时出现、页数必须等于天数 × 每日页数、非法输入。运行确认缺少实现后补齐。
6. 前端新增 `DailyPattern`、`DEFAULT_DAILY`/`DEFAULT_DAILY_SUN`、`newDaily`、`daysBetween`、`dailyPages`、`clampDaily`；`pagesFor` 对 `daily` 自动推导页数，手工改页数被忽略。`DailyFields` 提供日期范围（起点 + 天数）、每日页数、整点范围、字号/线宽/线色、标题格式与星期语言，以及昼夜着色开关和经纬度/UTC 偏移/两色控件；中英词条同步。
7. 验证：`cargo test` 全部通过（新增 7 项 daily 集成测试，并把两页一日时间轴加入真实 Tectonic e2e，八页混合文档编译通过且无缺字）；`cargo clippy --all-targets -- -D warnings` 通过；`yarn test` 通过，`tsc --noEmit` 与 Biome 通过。

## 年历（year）

1. 对照 archive 分支 `backend/year.rs` 的 `YearPattern` 与 `draw_year`：一页排 `rows × cols` 个月，`page_months` 的取页数学等价于「每页连续 `rows × cols` 个月」；单元格复用 `octan_week` 的迷你月历画法（月份标题、星期表头、日期，无内部格线）；节假日是 `日期 → 名称` 映射，`show_holidays` 关闭时连周末的红色也一并关闭。archive 还依赖系统时区，本次不搬；农历先空着，见第 8–12 条。
2. 节假日提升为文档级共享数据：`Document` 新增 `holidays: BTreeMap<String, String>`（上限 4096 条、名称 ≤128 字符、键必须是真实日期），`BodyTemplate::draw` 增加 `holidays` 参数，年历是唯一读取者；这样多节共用同一份节假日，导入只需一次。
3. 先写 `tests/year.rs`：3×4 一页 12 月、5 个月分 3 页且尾页留空槽、节假日与周末着色、`showHolidays=false` 只用文字色、页数必须等于网格容量、非法日期键、超长名称与 `rows=13`。运行确认 `unknown variant 'year'` 后补实现。
4. 新增 `templates/year.rs`：`YearPattern` 校验月份跨度、1–12 的行列、格式串、星期表头、颜色与数值；`required_pages() = ceil(months ÷ (rows × cols))`，`document.rs` 在计划阶段拒绝页数不符。
5. 单元格行高按固定 6 周计算（`WEEK_ROWS_MAX`），而不是按月自己的周数：否则同一行里 4 周的月份会比 5 周的月份行距更稀，日期无法横向对齐。首版按各自周数分行，栅格化后目检明显不齐，改为固定 6 周。
6. 前端新增 `YearPattern`、`DEFAULT_YEAR`、`newYear`、`yearPages`、`clampYear`，`clampMonthSpan` 增加 `fallbackMonth` 参数（年历回落到 `2027-01`，月历/打卡仍回落 `2026-08`）；`.ics` 解析放在 `src/lib/ics.ts`（展开折行、只认 `DTSTART`/`DTEND`/`SUMMARY`、`DTEND` 为开区间所以末日减一、跨日事件逐日展开、同日后者覆盖，不处理 RRULE/时区），Tauri 侧新增 `open_ics_file` 命令复用文本读取上限逻辑；`HolidaysPanel` 负责导入与清空，导入为增量合并。
7. 验证：`cargo test` 全部通过（新增 7 项 year 集成测试与 1 项真实 Tectonic 编译）；`cargo clippy --all-targets -- -D warnings` 通过；`yarn verify` 四条全绿，`yarn test` 195 项通过。栅格化 `build/year-sample.pdf` 目检 2027 年 12 个月：3×4 布局、同行月份日期对齐、节假日与周末着色、页眉与页码位置均正确。

## 年历农历副标签

1. 选型：Node 侧 `lunar-typescript` 1.8.7（MIT、零依赖、自带 `.d.ts`、与 `lunar-javascript` 算法逐日一致），Rust 侧不引入农历库。理由是复用已有节假日范式——数据在可测的 TS 侧算一次，Rust 保持纯渲染器，Android 交叉编译不必再验一个 crate，顺带把节气/农历节日的能力留在前端。
2. 先验证库的全域不变量（脚本在 /tmp，未入库）：逐日跑 1–9999 年共 3.65M 天，0 次抛错，农历日要么 +1 要么回到初一，0 处违反；1900-01-31 与 2026-02-17 均为正月初一（与项目节假日数据一致），2025-07-25 为闰六月初一（`getMonth()` 返回 -6）。单年 3653 天换算约 39ms。
3. Rust 侧只加绘制与校验：`Document` 新增 `lunar: BTreeMap<String, String>`（上限 4096 条、键必须是真实日期、标签非空且 ≤128 字符），`YearPattern` 新增 `showLunar`（默认 false），`draw_month` 在日号下方再画一行。
4. 布局细节改了三版才定：初版用格高比例分行（`row + 2.32` / `row + 2.74`），实际排版间距 6.9pt 过于松散，且间距随格高缩放、密集网格下会自然重叠。最终改为「行心对称 + 按字号固定间距」：`stacked_height = (日期字号 + 农历字号) × pt→mm + 0.35mm`，两行各偏移半个 `stacked_height`；格高不足 `stacked_height` 时（如 12 行网格）退回单行日号并跳过农历，不硬塞。
5. 副标签字号 = `min(日期字号 × 0.5, 格宽 × 0.92 ÷ 字数)`，下限 1pt；颜色直接复用当天日期色，所以节假日与周末的农历也是节日色。
6. 前端新增 `src/lib/lunar.ts`（唯一暴露面 `lunarLabels` / `yearLunarLabels` / `documentLunarLabels`）：中文「初一月名、其余日名」（台历惯例，比月+日短一半），英文用 `M1`/`LM6` 与纯日号；超范围或非法输入返回空映射而不抛错，农历只是副标签。库约 100KB gzip，`import()` 懒加载，主包只涨 0.6KB（gzip 159.14 → 159.77KB），农历库独立 chunk 310KB（gzip 103KB）。
7. `YearFields` 加「农历」开关；中英词条同步；`docs/latex-framework.md` 补 `showLunar` 与顶层 `lunar` 的语义。
8. 验证：`cargo test` 128 项全通过（`tests/year.rs` 新增 6 项：日号下方绘制、复用日期色、关闭时不画、缺标签静默跳过、非法键/空标签/超长标签被拒、字号按格宽收紧，以及 12×1 密集网格退回单行）；`yarn test` 211 项通过（`lunar.test.ts` 13 项，含 1 年与 9999 年边界）；`yarn verify` 四条全绿；`build/year-sample.pdf` 用 `pdftotext -bbox` 核对坐标：日号 y≈97.9–102.8、农历 y≈103.2–105.7（5pt 字号行距约 5.4pt），与下一行 y≈123.4 不重叠。

## 修复 Linux 下启动即 SIGSEGV（与农历无关）

1. 现象：`yarn tauri dev` 里 `Running target/debug/base6-techo` 后进程立刻段错误退出（exit 139），`coredumpctl` 显示 SIGSEGV。
2. 先排除「是我这次改动引入的」：`git stash -u` 暂存全部改动、重新编译运行，同样崩溃 → 既有问题。
3. 从 core 取栈（`coredumpctl gdb <pid>`）→ 崩在 `hb_table_lazy_loader_t<OT::head,1,true>::create`，即 HarfBuzz 解析字体表时。同时看到两份 HarfBuzz：栈帧地址落在可执行文件自身（`hb_font_create` 是 `T` 符号），而调用来自 `/usr/lib/libfreetype.so.6` → `/usr/lib/libpango-1.0.so.0` → GTK。
4. 用 `LD_DEBUG=bindings` 定位：`binding file /usr/lib/libharfbuzz.so.0 [0] to src-tauri/target/debug/base6-techo [0]: normal symbol hb_font_create` —— 系统 libharfbuzz 15.1.0 把自己的符号解析到了可执行文件里静态链接的 HarfBuzz 8.3.0（tectonic_bridge_harfbuzz 0.3.3 自带）。两套 ABI 混用，布局时崩溃。
5. 根因是「可执行文件默认导出静态库符号」+「系统 harfbuzz 在 2026-10-28 从 14.6 升到 15.0、11-06 升到 15.1」：旧版本没有走这条被劫持的路径，所以之前能跑。
6. 修复：`src-tauri/build.rs` 在非 Android 目标上加 `cargo:rustc-link-arg=-Wl,--exclude-libs,ALL`，隐藏静态库符号。验证：`readelf --dyn-syms` 里 `hb_` 导出从 103 个降到 0，进程可正常常驻（timeout 15 后 exit=124 而非 139），`yarn tauri dev` 正常起窗口并加载前端。Android 分支不改变（那里依赖显式导出 JNI 符号，仍只加 `-lc++_shared`）。
