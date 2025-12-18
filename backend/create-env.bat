@echo off
echo DATABASE_URL="postgresql://postgres:postgres@localhost:5432/waybills?schema=public" > .env
echo PORT=3000 >> .env
echo JWT_SECRET="dev_secret_key_change_in_production_12345678" >> .env
echo JWT_EXPIRES_IN="15m" >> .env
echo NODE_ENV="development" >> .env
echo .env file created successfully!
type .env
