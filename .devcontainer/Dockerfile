FROM ubuntu:23.10

WORKDIR /home/

COPY . .

# Install curl and Node.js
RUN apt-get update && \
    apt-get install -y curl && \
    curl -sL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g yarn

RUN bash ./setup.sh

ENV PATH="/root/.cargo/bin:$PATH"
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

RUN RUST_BACKTRACE=full cargo install --git https://github.com/project-serum/anchor avm --locked --force

# replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

RUN avm install 0.29.0
RUN avm use 0.29.0

# confirm installation
RUN node -v
RUN npm -v
