#!/usr/bin/env bash

echo "Create .env file..."
cp ./examples/env.example ./.env

echo "Copy function calls..."
cp ./examples/function_calls/*.mjs ./function_calls/