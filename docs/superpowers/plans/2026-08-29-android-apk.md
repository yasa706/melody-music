# Melody Music Android APK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Capacitor 8 Android wrapper for Melody Music that loads the deployed Cloudflare site and produces an installable debug APK via GitHub Actions.

**Architecture:** Keep the existing Cloudflare Worker/D1/R2 site authoritative. A small Capacitor Android shell loads `https://melody-music.gotoulus.workers.dev`; GitHub Actions creates the Android native project and compiles a debug APK on Ubuntu with Node 22 and Java 21.

**Tech Stack:** Capacitor 8.4.2, Node.js 22, Java 21, Gradle/Android SDK on GitHub-hosted runner.

**Spec:** Conversation-approved Android wrapper design (2026-08-29).

## Global Constraints

- App name: `Melody Music`.
- App ID: `com.glory.melodymusic`.
- Version: `1.0.0`.
- Remote site: `https://melody-music.gotoulus.workers.dev`.
- Do not modify the existing Cloudflare backend, D1, R2, or `/admin`.
- Produce a debug APK for direct sideloading; Play Store signing is out of scope.

---

### Task 1: Capacitor wrapper configuration

**Files:**
- Create: `android-app/package.json`
- Create: `android-app/capacitor.config.json`
- Create: `android-app/www/index.html`
- Test: `test/android-project.test.mjs`

**Interfaces:**
- Consumes: deployed HTTPS Melody Music site.
- Produces: a valid Capacitor project shell consumable by `npx cap add android`.

- [ ] Write tests asserting app ID, app name, remote URL, webDir, and exact Capacitor 8.4.2 dependencies.
- [ ] Run tests and verify they fail because files do not exist.
- [ ] Add minimal project files.
- [ ] Run tests and verify they pass.

### Task 2: GitHub Actions APK builder

**Files:**
- Create: `.github/workflows/build-android-apk.yml`
- Modify: `test/android-project.test.mjs`

**Interfaces:**
- Consumes: `android-app/package.json` and `capacitor.config.json`.
- Produces: `Melody-Music-1.0.0-debug.apk` as a GitHub Actions artifact.

- [ ] Add failing workflow assertions for Node 22, Java 21, Capacitor Android generation, Gradle debug build, APK rename, and artifact upload.
- [ ] Run tests and verify failure.
- [ ] Add workflow implementation.
- [ ] Run tests and verify pass.

### Task 3: Packaging and verification

**Files:**
- Create: `README-ANDROID.md`
- Create: `/mnt/data/melody-music-android-github.zip`

**Interfaces:**
- Produces: upload-ready source bundle and clear GitHub build/download steps.

- [ ] Run full local static test suite.
- [ ] Validate JSON files parse successfully.
- [ ] Package repository overlay preserving `.github` and `android-app` paths.
- [ ] List ZIP contents and verify expected files are present.
