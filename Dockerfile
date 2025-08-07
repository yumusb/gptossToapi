# 使用官方 Deno 镜像
FROM denoland/deno:alpine

# 设置工作目录
WORKDIR /app

# 复制源代码
COPY . .

# 缓存依赖
RUN deno cache main.ts

# 暴露端口
EXPOSE 8000

# 启动应用
CMD ["deno", "run", "--allow-net", "main.ts"]