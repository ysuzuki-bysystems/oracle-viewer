.PHONY: up
up:
	docker run --name=oracle-viewer -d --init --rm --net=host -eHOSTNAME=:: -ePORT=13000 -v $(CURDIR)/.env.production.local:/app/.env oracle-viewer:latest node --env-file=.env ./server.js

.PHONY: down
down:
	docker stop oracle-viewer

.PHONY: build
build:
	docker build -t oracle-viewer .
