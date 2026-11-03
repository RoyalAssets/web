# Homelab media stack

This Docker Compose project groups six cooperating services in one stack:

- Jellyfin — streams the finished media library
- Seerr (formerly Jellyseerr) — lets you request movies and shows
- Prowlarr — manages indexers and syncs them to Radarr and Sonarr
- Radarr — manages movie requests and imports
- Sonarr — manages TV and anime series requests and imports
- qBittorrent — downloads items sent by Radarr or Sonarr

These are six containers managed together by Compose, not one large container. AdGuard Home and the uptime monitor are separate projects and are not part of this media stack.

## How the services work together

    Seerr --requests--> Radarr (movies) / Sonarr (TV + anime)
    Prowlarr --indexers--> Radarr and Sonarr
    Radarr / Sonarr --download jobs--> qBittorrent
    qBittorrent --completed files--> Radarr / Sonarr
    Radarr / Sonarr --organized library--> Jellyfin
    Seerr --checks existing library--> Jellyfin

Seerr connects to Jellyfin, Radarr, and Sonarr. It does not connect directly to Prowlarr or qBittorrent. Prowlarr syncs indexers into Radarr and Sonarr; those apps are configured with qBittorrent as their download client.

## Shared folder layout

The default .env stores files under ./data:

    data/
    ├── downloads/
    │   ├── incomplete/
    │   └── torrents/
    │       ├── anime/
    │       ├── movies/
    │       └── tv/
    └── media/
        ├── anime/
        ├── movies/
        └── tv/

The Compose file mounts this same host directory as /data in qBittorrent, Radarr, Sonarr, and Jellyfin. Jellyfin gets read-only access. Use the /data/... paths in each app, not host paths such as ./data/....

Keeping downloads and the finished library under the same DATA_ROOT filesystem helps the *Arr apps import completed downloads efficiently and use hardlinks where supported.

If you already have media/download folders on the Docker host, set DATA_ROOT in .env to their common parent directory. That parent should contain both downloads and media. Use a path on the machine running Docker: a Windows workstation path will not work if Docker is running on a separate Linux homelab server. Do not move existing files; match the layout to where they already live, or plan a deliberate migration first.

## Before starting

This setup assumes Docker Engine and Docker Compose are available on the machine that will host the services. The LinuxServer containers use PUID and PGID; on a Linux host, set those in .env to the account that should own the files (check with id -u and id -g). Make sure that account can write to the app config folders, downloads, and media folders. Seerr's config folder must also be writable by its container.

Create the directories on the Docker host before starting. For a Linux host, from this folder:

    mkdir -p data/downloads/incomplete data/downloads/torrents/anime data/downloads/torrents/movies data/downloads/torrents/tv data/media/anime data/media/movies data/media/tv

On Windows, create the same folders under data in File Explorer, or run this PowerShell command from this folder:

    $dataDirs = @("data/downloads/incomplete", "data/downloads/torrents/anime", "data/downloads/torrents/movies", "data/downloads/torrents/tv", "data/media/anime", "data/media/movies", "data/media/tv")
    $dataDirs | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }

If Docker runs on another computer, create the folders there instead. Bind mounts refer to paths on the Docker host.

## Start and manage the stack

Run these commands from this folder:

    docker compose config
    docker compose pull
    docker compose up -d
    docker compose ps

docker compose config prints the resolved configuration. Check that DATA_ROOT is set correctly before starting. To view logs:

    docker compose logs -f qbittorrent

The qBittorrent image prints a temporary Web UI password in its startup logs. Sign in as admin, then change the password in qBittorrent settings.

Stop the containers while keeping their configuration and media:

    docker compose down

## First-time setup order

Open these pages using the Docker host's address:

| App | Address |
| --- | --- |
| Jellyfin | http://SERVER-IP:8096 |
| Seerr | http://SERVER-IP:5055 |
| Prowlarr | http://SERVER-IP:9696 |
| qBittorrent | http://SERVER-IP:8080 |
| Radarr | http://SERVER-IP:7878 |
| Sonarr | http://SERVER-IP:8989 |

Replace SERVER-IP with the address of the Docker host. These URLs are for a browser on your network. For app-to-app connections inside Compose, use the service names below.

### 1. Configure qBittorrent

1. Sign in and change the temporary password.
2. Set the default save path to /data/downloads/torrents.
3. Set incomplete/t while downloading files to /data/downloads/incomplete.
4. Create categories named movies and tv if they are not already created. Set their save paths to /data/downloads/torrents/movies and /data/downloads/torrents/tv.
5. In the qBittorrent Web UI settings, make sure the Web UI is reachable by other containers on the Docker network. Leave authentication enabled.

Sonarr handles both regular TV and anime series. Its completed anime downloads may use the tv category; Sonarr imports each series into whichever root folder you assigned to that series.

### 2. Configure Radarr and Sonarr

In Radarr:

- Add /data/media/movies as a root folder.
- Under Settings → Download Clients, add qBittorrent with host qbittorrent, port 8080, your qBittorrent username/password, and category movies.
- Select a quality profile and a sensible minimum availability setting.

In Sonarr:

- Add /data/media/tv and /data/media/anime as root folders.
- Under Settings → Download Clients, add qBittorrent with host qbittorrent, port 8080, your qBittorrent username/password, and category tv.
- Select a quality profile and a sensible series type. When adding each series, choose the correct root folder: /data/media/tv for TV or /data/media/anime for anime.

In both apps, the API key is under Settings → General. Keep it private.

### 3. Add indexers in Prowlarr

1. Add indexers you are authorized to use in Indexers.
2. Go to Settings → Apps and add Radarr and Sonarr.
3. For Radarr use http://radarr:7878; for Sonarr use http://sonarr:8989.
4. Copy each app's API key from Settings → General, test the connection, and save.
5. Trigger Sync App Indexers. Prowlarr will sync compatible indexers to each app based on their categories.

For searches started in Radarr or Sonarr, you do not need to add qBittorrent to Prowlarr. The download client belongs in Radarr and Sonarr.

### 4. Add libraries in Jellyfin

Create libraries using these container paths:

| Library | Folder | Content type |
| --- | --- | --- |
| Movies | /data/media/movies | Movies |
| TV Shows | /data/media/tv | Shows |
| Anime | /data/media/anime | Shows for episodic anime |

If you keep anime films in the Movies library, place them under /data/media/movies. Jellyfin library types can affect matching and display, so use the type that fits the files in each library.

### 5. Connect Seerr

In Seerr's setup:

1. Connect your Jellyfin server using http://jellyfin:8096 and finish login/library sync.
2. Add Radarr using http://radarr:7878, its API key, a quality profile, and root folder /data/media/movies.
3. Add Sonarr using http://sonarr:8989, its API key, a quality profile, and a root folder. Use /data/media/tv as the default for TV requests.
4. Enable library scanning so Seerr can see items already available in Jellyfin.

Seerr sends movie requests to Radarr and show requests to Sonarr. To request anime through Seerr, configure Sonarr's anime series handling and choose the anime root folder for those series in Sonarr. Confirm the resulting path in Sonarr before relying on automated requests.

### Request-to-library flow

When a request is approved, Seerr sends it to Radarr or Sonarr. That app searches using indexers synced by Prowlarr, sends the chosen download to qBittorrent, then imports the completed files into the selected library root. Jellyfin scans the library folders and displays the media.

If you use a reverse proxy for your cu-o.com domains, point each proxy entry at the matching Docker host port above. The apps still use Compose service names for their internal connections.

## Notes

- The old Jellyseerr project has moved to Seerr. This setup uses the official Seerr image while keeping the existing jellyseerr folder and service name.
- The web ports are published on the Docker host. Keep access to these apps on your trusted network or behind your existing reverse proxy, and use a unique qBittorrent Web UI password.
- Jellyfin hardware transcoding is not configured because it depends on the host GPU and device mapping.
