FROM nginx:1.27-alpine

# This repository is a static HTML/CSS site.
COPY src/ /usr/share/nginx/html/

EXPOSE 80
