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

# Install Bun v1.3.14 (matches local working WSL environment)
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14"
ENV PATH="/root/.bun/bin:${PATH}"
ENV BUN_JSC_useWasmIPInt=false
ENV BUN_JSC_useJIT=0



# Clone and install official gbrain globally
WORKDIR /usr/src
RUN git clone https://github.com/garrytan/gbrain.git
WORKDIR /usr/src/gbrain
RUN bun install

# Set up global and local compatibility shell wrappers to run gbrain from the physical path (bypassing Bun VFS bugs)
RUN mkdir -p /root/.bun/bin /home/radesh/.bun/bin
RUN echo '#!/bin/sh\nexec bun /usr/src/gbrain/src/cli.ts "$@"' > /root/.bun/bin/gbrain && chmod +x /root/.bun/bin/gbrain
RUN ln -s /root/.bun/bin/gbrain /home/radesh/.bun/bin/gbrain

# Install OpenClaw globally (standard method)
RUN npm install -g openclaw@latest

# Set up the main app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Copy OpenClaw configuration templates
# Note: User must copy ~/.openclaw/ contents into openclaw-config/ in their local repository
COPY openclaw-config /root/.openclaw

# Copy database seed files
COPY gbrain-seed /usr/src/gbrain-seed

# Expose ports (Railway web port and OpenClaw Gateway port)
EXPOSE 3002
EXPOSE 18789

# Startup command
CMD ["npm", "start"]
