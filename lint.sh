#!/bin/bash

set -ex

deno check src/ scripts/
deno lint src/ scripts/
deno fmt src/ scripts/
