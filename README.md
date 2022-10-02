<pre></pre>
<!--suppress HtmlDeprecatedAttribute -->
<p align="center">
  <a href="https://m-ld.org/">
    <picture>
      <!--suppress HtmlUnknownTarget -->
      <source media="(prefers-color-scheme: light)" srcset="https://m-ld.org/m-ld.svg"/>
      <!--suppress HtmlUnknownTarget -->
<source media="(prefers-color-scheme: dark)" srcset="https://m-ld.org/m-ld.inverse.svg"/>
      <img alt="m-ld" src="https://m-ld.org/m-ld.svg" width="300em" />
    </picture>
  </a>
</p>
<pre></pre>

[![Project Status: Active – The project has reached a stable, usable state and is being actively developed.](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active)
[![Gitter](https://img.shields.io/gitter/room/m-ld/community)](https://gitter.im/m-ld/community)
[![GitHub Discussions](https://img.shields.io/github/discussions/m-ld/m-ld-spec)](https://github.com/m-ld/m-ld-spec/discussions)

# **m-ld** specification
**m-ld** is a decentralised live information sharing component with a JSON-based
API.

This repository defines the platform-independent specification for **m-ld**.

## website
The [documentation](./doc) is built using typedoc, and delivered to the
specification documentation website at https://spec.m-ld.org/.

## types
The engine API is partially specified as [types](./types/index.ts) using
Typescript as an abstract specification language. Note that these types are not
used directly by engine implementations, because they are intentionally
high-level and agnostic to platform details, such as threading model. Instead,
engines use types in their native language.

## compliance tests
The [compliance](./compliance) folder defines a set of Jasmine integration tests
to check the compliance of a clone engine to specification. These tests require
orchestration components to be provided by the engine project.

## work in progress
- Specification work in progress can be found on the repository Wiki tab.
- Issues relating to the abstract specification are logged on the Issues tab.
- Contributions are welcome! Contributed work is governed according to a
  [CAA](./CONTRIBUTING), the GitHub Community
  [Guidelines](https://docs.github.com/articles/github-community-guidelines),
  and the [privacy](https://m-ld.org/privacy/) policy.

## scripts
Scripts are run with `npm`.
- The `test` script is not intended to be run from this project. See the
  [compliance](./compliance) folder README for details.
- The `build` script is used to generate the website.
- The `doc-dev` script can be used after `build` to create a local web server
  watching for documentation changes.

## publishing
This project uses semantic versioning. There are two main branches.
- The `edge` branch is for pre-releases. It is delivered to edge.spec.m-ld.org.
  A merge into `edge` should be immediately followed by a pre-release if it
  affects versioned components.
- The `master` branch is for releases. It is delivered to spec.m-ld.org. A merge
  into `master` should be immediately followed by a release if it affects
  versioned components.

`npx publish.sh ≪newversion≫` (from
[m-ld-io-js-build](https://github.com/m-ld/m-ld-io-js-build)) builds the
project, increments the version as specified (e.g. `patch`), pushes the code and
publishes the package. *Ensure the repo is up-to-date and on* master *(release)
or* edge *(pre-release)*.
