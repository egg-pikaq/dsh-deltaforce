# DSH Cinematic Boot

独立的 DeepSeek Harness 启动动画插件。太空开场接入六步身份验证，较慢的英文女声与字幕同步，前导使用英文界面、完整的凭证扫描舱，六步在同一座正视终端内追加模拟日志，字符雨持续落下，徽记与字样沿原路径往返拼合，随后播放本地 CG，最后以「天空属于哈夫克」行星夜面淡入 DSH。身份资料页显示 `GUEST NODE`。已按 Windows DSH `0.2.2-rc.3` / Cordis `4.1.0` 的本机安装包进行适配。

## 安装和使用

安装包是 DSH 可接收的 npm 本地压缩包 `dsh-deltaforce-0.2.8-preview.1.tgz`。项目使用 Node.js 22.19 或更高版本构建。

1. 完全退出 DSH（包含托盘进程）。
2. 在包含安装包的目录执行以下 PowerShell 命令。已将 `dsh` 加入 PATH 时，可直接使用 `dsh`。
3. 重新打开 DSH。用 **Esc** 或画面上的 **跳过** 随时进入主界面。设置项在 **设置 → 内置插件 → Cinematic Boot**。

```powershell
$cli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
& $cli plugin --profile desktop add (Resolve-Path '.\dsh-deltaforce-0.2.8-preview.1.tgz').Path --ignore-scripts --prefer-offline
```

本地安装包本身已经在磁盘上。桌面 profile 的其他依赖若缺少 pnpm 缓存，安装时仍可能需要联网补齐。

Windows Web profile 的设置快捷键是 **Ctrl+Alt+,**，Desktop 默认是 **Ctrl+,**。关闭自动播放后仍可在设置里手动重播。同页热重载会释放本插件的覆盖层，之后可手动重播。音量和开关保存在当前界面的本地存储中。浏览器可能限制自动带声播放，遇到限制会继续显示字幕并静音进入后续段落。点击设置中的「重播启动动画」可试听。

## 可选本地视频

默认包自带 17.65 秒前导英文播报和约 3.35 秒片尾。要加入原片，将有权使用的本地素材放在源码目录的 `assets/boot.mp4` 再打包。建议使用 fast-start H.264/AAC MP4。已适配的 13.723 秒片源保留原声，完整序列约 35 秒。片源缺失时，中段使用约 10 秒的雷达回退动画。前导音频无法播放时，画面由本地时钟驱动并保留英文字幕，覆盖层从启动起最多保留 42 秒。

```powershell
npm run build
npm test
npm pack --ignore-scripts --pack-destination dist
```

原片无需重编码。默认发布包和 Git 仓库均省略第三方视频，个人素材版压缩包应保留在本地。新播报音频在 Windows 本机用 Microsoft Zira 合成，轻度滤波与短回声用于统一科技感。要重新制作，更新 `src/intro-cues.json` 后，运行 `./tools/record-intro.ps1`（需 Python 3）和 `npm run build`。

## 卸载

彻底退出 DSH 后运行下列命令，再重新打开 DSH。将 `desktop` 替换为实际安装的 profile。本机当前 DSH 版本会同步依赖和 bundle 列表，可核对相应 profile 的 `package.json`。浏览器可能继续保留插件自己的设置键 `dsh-deltaforce:settings:v1`，可按需在该站点存储中单独清除。

```powershell
& $cli plugin --profile desktop remove dsh-deltaforce
```

## 本地隔离测试

在新 PowerShell 窗口里使用 D 盘测试目录。以下环境变量只影响该窗口和它启动的进程。DSH Web 测试 profile 会从内置 Web 模板初始化。

```powershell
$testRoot = Join-Path (Get-Location) 'dist\dsh-test'
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
$env:DSH_HOME = $testRoot
$cli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
& $cli --profile cinematic-test --from-default-profile web --dump-config | Out-Null
& $cli plugin --profile cinematic-test add (Resolve-Path '.\dist\dsh-deltaforce-0.2.8-preview.1.tgz').Path --ignore-scripts --offline
& $cli --profile cinematic-test --dump-config | Select-String '^\s*name: dsh-deltaforce$'
& $cli --profile cinematic-test --host 127.0.0.1 --port 0 --no-open
```

在测试浏览器打开 CLI 给出的地址。依次检查六步身份验证与英文同步、代号、原片完整播放、太空片尾、窗口缩放、自动放行、Esc 跳过、音量和媒体回退。如需测试 MP4，用本地素材版在同一测试 profile 中重新安装。退出测试 Host 后可对该 profile 执行卸载命令，重启并确认画面直接进入 DSH。

## 结构

- `cordis.patch.yml` 将插件插入 Cordis Loader。
- `src/index.js` 在 DSH 现有 Host 注册固定的 WAV、PNG、JPEG 和 MP4 资源路由。
- `src/client.js` 注册设置、处理页面启动和热重载释放。
- `src/splash.js` 管理覆盖层的前导、原片、回退和片尾。六步字幕和节奏来自 `src/intro-cues.json`，画面由 `src/sequence.js`、`src/terminal-screen.js` 和 `src/sequence.css` 渲染。
- `tools/build.mjs` 将浏览器模块做成本地同包工厂。安装包不执行构建脚本。

加载方式参考 [dsh-haavk-boot](https://github.com/ShawSheepSussiah/dsh-haavk-boot)。安全边界和核验记录见 [SECURITY.md](SECURITY.md)。
