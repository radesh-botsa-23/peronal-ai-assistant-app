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
    && rm -rf /var/lib/apt/lists/*

# Install OpenClaw globally as root
RUN npm install -g openclaw@latest

# Create a non-root user with UID 1000
RUN useradd -m -u 1000 user
ENV HOME=/home/user
ENV PATH="/home/user/.bun/bin:${PATH}"
ENV BUN_JSC_useJIT=0

# Create directories and assign ownership to user 1000
RUN mkdir -p /usr/src/app /usr/src/gbrain /usr/src/gbrain-seed /home/user/.openclaw /home/user/.gbrain \
    && chown -R user:user /usr/src /home/user

# Switch to the non-root user
USER user

# Install Bun as user
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14"

# Clone and install official gbrain
WORKDIR /usr/src
RUN git clone https://github.com/garrytan/gbrain.git
WORKDIR /usr/src/gbrain
RUN bun install

# Set up global and local compatibility shell wrappers to run gbrain
RUN mkdir -p /home/user/.bun/bin
RUN echo '#!/bin/sh\nexec bun /usr/src/gbrain/src/cli.ts "$@"' > /home/user/.bun/bin/gbrain && chmod +x /home/user/.bun/bin/gbrain

# Create symlink in /home/radesh/ for backwards compatibility
USER root
RUN mkdir -p /home/radesh/.bun/bin && ln -sf /home/user/.bun/bin/gbrain /home/radesh/.bun/bin/gbrain && chown -R user:user /home/radesh
USER user

# Set up the main app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY --chown=user:user package*.json ./
RUN npm install

# Copy application source code
COPY --chown=user:user . .

# Copy OpenClaw configuration templates to home directory
COPY --chown=user:user openclaw-config /home/user/.openclaw

# Copy database seed files
COPY --chown=user:user gbrain-seed /usr/src/gbrain-seed

# Expose ports (Railway web port and OpenClaw Gateway port)
EXPOSE 3002
EXPOSE 18789

# Startup command
CMD ["npm", "start"]
