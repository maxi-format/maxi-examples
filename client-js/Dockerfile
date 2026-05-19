FROM nginx:alpine

# Copy the browser client HTML
COPY client-js/browser-client/ /usr/share/nginx/html/

# Custom nginx config to serve JS with correct MIME type
COPY client-js/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
