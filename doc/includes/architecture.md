## Architecture
**m-ld** is a decentralised (multi-master) graph data store with a JSON-based
API. In the picture, the "browser", "microservice" and Australia are just
possible environments for a clone – and there could be any number of clones,
from a handful to hundreds.

<img src="media://clone-env.svg" alt="clone environments" width="500"/>

All clones of the data can accept reads and writes with no waits for other
clones (consensus-free). Atomic read and write transactions are effected via a
JSON API, which is presented suitably for the clone engine environment.
Communication between clones is via a messaging layer, for example MQTT
(publish-subscribe).

A clone can be deployed on any platform that has a network connection and for
which an engine implementation exists. At least one clone would have to use
reliable storage if any data persistence guarantee is required.

The data may at any moment differ between clones, but in the absence of any
writes and with a live connection, then all clones will converge on some state.