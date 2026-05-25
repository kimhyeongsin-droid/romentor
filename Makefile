.PHONY: help install dev build start clean

help:
	@echo "Available targets:"
	@echo "  make install   - 의존성 설치"
	@echo "  make dev       - 개발 서버 실행 (http://localhost:3000)"
	@echo "  make build     - 프로덕션 빌드"
	@echo "  make start     - 프로덕션 서버 실행"
	@echo "  make clean     - .next 빌드 캐시 제거"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

clean:
	rm -rf .next
