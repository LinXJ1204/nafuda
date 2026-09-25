index index.html;
server_tokens off;
absolute_redirect off;
resolver 127.0.0.11 valid=10s ipv6=off;

add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "DENY" always;
add_header Content-Security-Policy $nafuda_csp always;

location /api/ {
    set $api http://api:3000;
    proxy_pass $api;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 30s;
}

location /assets/ {
    expires max;
    try_files $uri =404;
}

location / {
    expires -1;
    try_files $uri /index.html;
}
