# TODO

## Post-Accept 待办

由 2026-08-03 独立评分产生的扣分项，按优先级记录：

- [x] Renderer 自动化验证：`test/renderer-smoke.test.tsx` 覆盖新建草稿、生成团队、编辑角色、添加角色、选择目录、校验和导出；`npm test` 43 个用例通过。
- [ ] Windows 实机/CI 冒烟：已新增 `.github/workflows/windows-smoke.yml`、`scripts/windows-smoke.ps1` 和应用内 `AGENT_TEAM_STUDIO_SMOKE=1` 冒烟模式；仍需在 Windows runner 实际运行安装/启动/15 个 IPC/生成/导出链路后登记通过。
- [x] 同步 README 验证状态：已将“35 个测试用例”更新为当前 43 个，并补充 Renderer/Windows 冒烟状态说明。

当前状态：第 1、3 项已完成；第 2 项已具备可执行 CI 路径，尚缺 Windows runner 实跑证据。
