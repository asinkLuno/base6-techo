# ---- 构建阶段：Astro 静态构建（Yarn 4 monorepo）----
# 构建阶段用 glibc 基础镜像：esbuild（vite 依赖）在 Alpine/musl 下解析时 SIGSEGV 崩溃
# （"fatal error: fault"）。node:22-slim（Debian/glibc）可正常构建；运行时仍是 nginx。
FROM node:22-slim AS build
WORKDIR /app

RUN corepack enable

# 先拷清单与锁文件，利用 Docker 层缓存
# 拷贝根清单与锁文件（corepack 依 packageManager 字段取 yarn；.yarn/ 仅含本地缓存，无需拷贝）
COPY package.json yarn.lock .yarnrc.yml ./
COPY showcase/package.json showcase/package.json
RUN yarn install --immutable

# 拷入 showcase 源码并构建（产物在 showcase/dist/）
COPY showcase/ showcase/
RUN yarn workspace @base6/showcase build

# ---- 服务阶段：只放构建产物 + nginx ----
FROM nginx:1.25-alpine
COPY --from=build /app/showcase/dist/ /usr/share/nginx/html/showcase/
COPY showcase/nginx.conf /etc/nginx/conf.d/default.conf
