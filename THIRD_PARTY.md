# 数据与第三方组件来源

- `overlay/js/common.min.js`：OverlayPlugin 官方网页接口桥接文件，原样取自 https://overlayplugin.github.io/OverlayPlugin/assets/shared/common.min.js 。项目和许可证以 https://github.com/OverlayPlugin/OverlayPlugin 为准。
- 中文技能名称、图标编号、职业与冷却组数据：国服客户端数据导出仓库 https://github.com/thewakingsands/ffxiv-datamining-cn 。构建时对关键字段作了校验，数据文件 SHA-256 记录在 `overlay/data/manifest.json`。
- 英文技能名及键名与动作 ID 的事实对应关系： https://github.com/xivintheshell/xivintheshell 的 `src/Game/Data/Jobs` 和 `src/Game/Data/Shared`；来源提交记录在 manifest 中。本包没有包含排轴器实现代码。
- 离线技能图标： https://cafemaker.wakingsands.com/i/ ，按动作表图标编号下载；服务可能返回 WebP，保存前仅转换成 PNG，未改变内容。该服务为国服 XIVAPI 接口，说明见 https://cafemaker.wakingsands.com/docs/Icons 。
- 日志字段核对： https://github.com/OverlayPlugin/cactbot/blob/main/resources/netlog_defs.ts ，接口事件核对： https://overlayplugin.github.io/OverlayPlugin/devs/event_types.html 。
- 爆发药提示图标取自 xivintheshell 同一来源提交下的 `public/assets/Skills/General/Tincture.png`。药品仅保留为可选提示，不假定对应某个技能 ID。
- 用户提供的排轴器镜像： https://ffxivshell.neko7ina.com/ ，已核对其战斗导出格式；本包不包含该站的应用实现。
- FFLogs V2 OAuth 与报告字段： https://www.fflogs.com/api/docs 和 https://www.fflogs.com/v2-api-docs/ff/report.doc.html 。本地客户端和界面独立实现，仅通过官方 API 读取用户指定的公开战斗。

FINAL FANTASY XIV 的游戏名称、技能名称与图标版权归 SQUARE ENIX 及各自权利人所有。本项目为非官方独立复刻，不代表上述项目或游戏官方。

除上列外部组件和数据外，浮窗、导入、追轴与测试代码均为本次按说明重新实现。
