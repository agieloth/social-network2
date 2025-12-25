FROM golang:1.20

WORKDIR /app

# Install sqlite dev headers required for CGO (mattn/go-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libc6-dev libsqlite3-dev ca-certificates && rm -rf /var/lib/apt/lists/*

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build the server binary with CGO enabled (sqlite3 driver needs it)
ENV CGO_ENABLED=1
RUN go build -o /social

EXPOSE 8080

CMD ["/social"]
