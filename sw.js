/* =========================================================
   DRAMA TREE TRACKER
   Service Worker
   ========================================================= */

"use strict";


const CACHE_NAME =
    "drama-tree-tracker-v1";


const ASSETS_TO_CACHE = [
    "./",
    "./index.html",
    "./styles.css",
    "./app.js",
    "./manifest.json"
];


/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener(
    "install",
    event => {

        event.waitUntil(

            caches.open(
                CACHE_NAME
            )
            .then(
                cache =>
                    cache.addAll(
                        ASSETS_TO_CACHE
                    )
            )
            .then(
                () =>
                    self.skipWaiting()
            )

        );
    }
);


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener(
    "activate",
    event => {

        event.waitUntil(

            caches.keys()
                .then(
                    cacheNames =>
                        Promise.all(

                            cacheNames
                                .filter(
                                    cacheName =>
                                        cacheName !==
                                        CACHE_NAME
                                )
                                .map(
                                    cacheName =>
                                        caches.delete(
                                            cacheName
                                        )
                                )

                        )
                )
                .then(
                    () =>
                        self.clients.claim()
                )

        );
    }
);


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener(
    "fetch",
    event => {

        /*
         * Only handle GET requests.
         */

        if (
            event.request.method !== "GET"
        ) {
            return;
        }


        event.respondWith(

            caches.match(
                event.request
            )
            .then(
                cachedResponse => {

                    if (cachedResponse) {
                        return cachedResponse;
                    }


                    return fetch(
                        event.request
                    )
                    .then(
                        networkResponse => {

                            /*
                             * Cache successful same-origin
                             * responses dynamically.
                             */

                            if (
                                networkResponse &&
                                networkResponse.status === 200 &&
                                networkResponse.type === "basic"
                            ) {

                                const responseClone =
                                    networkResponse.clone();

                                caches.open(
                                    CACHE_NAME
                                )
                                .then(
                                    cache => {

                                        cache.put(
                                            event.request,
                                            responseClone
                                        );
                                    }
                                );
                            }


                            return networkResponse;
                        }
                    );

                }
            )

        );
    }
);