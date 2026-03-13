# animethemes-redirector

A small proxy that redirects [animethemes.moe](https://animethemes.moe) style URLs to video files hosted somewhere else besides's animetheme's perennially overloaded CDN. For instance, if you have VRChat worlds with playlists pointing at animethemes.moe URLs and want to swap the domain to a self-hosted mirror, you can find/replace the existing urls like:

```
https://animethemes.moe/anime/shingeki_no_bahamut_genesis/OP1-NCBD1080
to
https://your-proxy.example.com/anime/shingeki_no_bahamut_genesis/OP1-NCBD1080
```

The proxy queries the AnimeThemes GraphQL API to resolve the slug to a `.webm` path, then issues a `301` redirect to wherever your video files are actually served from.

## Getting the video files

The AnimeThemes team publishes backup torrents on [nyaa.si](https://nyaa.si) — search for `AnimeThemes.moe` to find them. The torrents use a `{year}/{season}/{AnimeName}-{OP/ED}{N}.webm` directory structure, which this proxy expects.

## Setup

### 1. Install and run the proxy

[Bun](https://bun.sh) is probably the easiest way to run this, but node/deno/whatever probably works too.

```sh
bun install
VIDEO_BASE_URL=https://your-video-host.example.com/video bun run src/index.ts
```

`VIDEO_BASE_URL` is the base URL where the torrent files are served from. The proxy appends the file's path (e.g. `2014/Fall/ShingekiNoBahamutGenesis-OP1.webm`) to construct the redirect target. It defaults to `http://localhost:8080/video` if unset.

### 2. Configure nginx (or other reverse proxy)

Add these blocks to your nginx server config. Adjust paths and upstream port as needed.

```nginx
# Cache redirects from the proxy so repeated requests don't re-hit the AnimeThemes API
proxy_cache_path /var/cache/nginx/animethemes levels=1:2 keys_zone=themes:10m inactive=7d;

server {
    # ... your existing server config (listen, server_name, TLS, etc.)

    # Serve .webm files directly from the torrent directory
    location /video/ {
        alias /wherever/you/downloaded/the/torrent/AnimeThemes/;
    }

    # Proxy /anime/* to the Hono app, caching 301 redirects for 7 days
    location /anime/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache themes;
        proxy_cache_valid 301 7d;
        proxy_cache_key "$uri";
    }
}
```

## Notes

- The proxy and video server are fully decoupled via `VIDEO_BASE_URL`, so you can run the proxy on Cloudflare Workers or any other platform while serving videos from elsewhere.
- The `301` status means browsers and nginx both cache redirects. Each unique URL only needs one live API call.
- AnimeThemes GraphQL API: `https://graphql.animethemes.moe/`
