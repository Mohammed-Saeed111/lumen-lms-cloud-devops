# Lab 01: Docker Containerization

## Objective

Containerize the MERN Learning Management System (LMS) using Docker and Docker Compose to run the frontend, backend, and database in a consistent local environment.

## Architecture

The application consists of three services:

- **Client:** React 19 and Vite, running on port `5173`.
- **Server:** Node.js 20 and Express, running on port `5000`.
- **Database:** MongoDB 8, storing application data in a named Docker volume.

## Files Created

| File | Purpose |
|---|---|
| `client/Dockerfile` | Defines how to build the frontend image. |
| `client/.dockerignore` | Excludes unnecessary files from the frontend build context. |
| `server/Dockerfile` | Defines how to build the backend image. |
| `server/.dockerignore` | Excludes unnecessary files and environment secrets from the backend build context. |
| `compose.yaml` | Defines services, networking, ports, health checks, and volumes. |

## Implementation

1. Created Dockerfiles for the frontend and backend.
2. Configured Docker Compose to run the frontend, backend, and MongoDB.
3. Added health checks for MongoDB and the backend API.
4. Configured service dependencies so the backend waits for MongoDB to become healthy, and the frontend waits for the backend.
5. Added named volumes for MongoDB data and Node.js dependencies.
6. Configured the backend to connect to MongoDB using the internal service hostname `mongo`.

## Validation

| Test | Result |
|---|---|
| Docker Compose configuration validation | Passed |
| Frontend and backend image builds | Passed |
| All three services started | Passed |
| Backend health endpoint | HTTP 200 OK |
| Frontend HTTP response | HTTP 200 OK |
| MongoDB connection | Successful |
| MongoDB data persistence after container restart | Passed |

## Useful Commands

Validate the Compose configuration:

```bash
docker compose -f compose.yaml config --quiet
```

Build the images:

```bash
docker compose -f compose.yaml build
```

Start the services:

```bash
docker compose -f compose.yaml up -d
```

Check service status:

```bash
docker compose -f compose.yaml ps
```

View backend logs:

```bash
docker compose -f compose.yaml logs --tail=50 server
```

Stop the services without deleting persistent volumes:

```bash
docker compose -f compose.yaml down
```

## Data Persistence Test

Created a test record in the separate `docker_lab` database, restarted the MongoDB container, and queried the record again.

The record remained available after the restart, confirming that the named volume preserves database data across container restarts.

## Security Notes

- Environment files are excluded from the Docker build contexts.
- Real environment files and credentials must not be committed to version control.
- MongoDB is not published directly to the host in this Compose configuration.
- The current setup is intended for local development, not production deployment.

## Outcome

The MERN LMS frontend, backend, and MongoDB database run together through Docker Compose. The services were validated, and MongoDB volume persistence was tested successfully.

**Next step:** Review production-oriented Docker improvements and prepare the project for a CI/CD pipeline.
