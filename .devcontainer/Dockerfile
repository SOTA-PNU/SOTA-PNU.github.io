FROM nginx:1.27-alpine

RUN apk add --no-cache git curl

WORKDIR /workspace

RUN mkdir -p /workspace

COPY nginx.conf /etc/nginx/conf.d/default.conf
