# 静态样张集：在仓库根构建（上下文须含 showcase/ 与 examples/）
FROM nginx:1.25-alpine

# 站点根放在 /showcase，样张（../examples 引用）平级放 /examples
COPY showcase/ /usr/share/nginx/html/showcase/
COPY examples/ /usr/share/nginx/html/examples/

# 默认根指到 showcase/，所以首页就是 index.html，../examples 相对路径也不破
COPY showcase/nginx.conf /etc/nginx/conf.d/default.conf
