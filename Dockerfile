# Use a Node.js base image supporting OpenClaw (Node 22+)
FROM node:22-slim

# Install system dependencies (needed to download/install Bun and build gbrain)
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    git \
    python3 \
    make \
    g++ \
    postgresql \
    postgresql-contrib \
    && rm -rf /var/lib/apt/lists/*

# Install OpenClaw globally as root
RUN npm install -g openclaw@latest

# Configure environment for the pre-existing non-root 'node' user (UID 1000)
ENV HOME=/home/node
ENV PATH="/home/node/.bun/bin:/usr/lib/postgresql/17/bin:/usr/lib/postgresql/16/bin:/usr/lib/postgresql/15/bin:${PATH}"
ENV BUN_JSC_useJIT=0
ENV BUN_JSC_useWasmIPInt=true


# Create directories and assign ownership to node
RUN mkdir -p /usr/src/app /usr/src/gbrain /usr/src/gbrain-seed /home/node/.openclaw /home/node/.gbrain \
    && chown -R node:node /usr/src /home/node

# Switch to the non-root node user
USER node

# Install Bun as node user
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14"

# Clone and install official gbrain
WORKDIR /usr/src
RUN git clone https://github.com/garrytan/gbrain.git
WORKDIR /usr/src/gbrain
RUN bun install

# Set up global and local compatibility shell wrappers to run gbrain
RUN mkdir -p /home/node/.bun/bin
RUN echo '#!/bin/sh\nexec bun /usr/src/gbrain/src/cli.ts "$@"' > /home/node/.bun/bin/gbrain && chmod +x /home/node/.bun/bin/gbrain

# Create symlink in /home/radesh/ for backwards compatibility
USER root
RUN mkdir -p /home/radesh/.bun/bin && ln -sf /home/node/.bun/bin/gbrain /home/radesh/.bun/bin/gbrain && chown -R node:node /home/radesh

# Build and install pgvector from source (not available as apt package in Debian Bookworm)
RUN PG_MAJOR=$(pg_config --version | awk '{print $2}' | cut -d. -f1) \
    && apt-get update \
    && apt-get install -y postgresql-server-dev-${PG_MAJOR} \
    && cd /tmp \
    && git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git \
    && cd pgvector \
    && make \
    && make install \
    && cd / && rm -rf /tmp/pgvector \
    && apt-get purge -y postgresql-server-dev-${PG_MAJOR} \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*
USER node

# Set up the main app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY --chown=node:node package*.json ./
RUN npm install

# Copy application source code
COPY --chown=node:node . .

# Copy OpenClaw configuration templates to home directory
COPY --chown=node:node openclaw-config /home/node/.openclaw

# Decode and extract database seed files (optional — skipped if seed file not in repo)
RUN if [ -f /usr/src/app/gbrain-seed.zip.base64 ]; then \
      base64 -d /usr/src/app/gbrain-seed.zip.base64 > /tmp/gbrain-seed.zip \
      && mkdir -p /usr/src/gbrain-seed \
      && python3 /usr/src/app/scripts/extract-seed.py \
      && cp -R /usr/src/app/gbrain-seed/* /usr/src/gbrain-seed/ 2>/dev/null || true \
      && rm -rf /tmp/gbrain-seed.zip /usr/src/app/gbrain-seed.zip.base64; \
    else \
      echo "No seed file found — GBrain will initialize a fresh database at runtime."; \
    fi





# Expose ports (Railway web port and OpenClaw Gateway port)
EXPOSE 3002
EXPOSE 18789

# Startup command
CMD ["npm", "start"]
