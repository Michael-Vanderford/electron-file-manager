
// this.addEventListener('install', function(event) {  
//     event.waitUntil(
//       caches.open('file-manager').then(function(cache) {
//         return cache.addAll([
//           '../assets/css/semantic.min.css',      
//         ]);
//       })
//     );
//   });


// const filesToCache = [
//     'test.js'
//     // '/scripts/semantic.min.js'
//     // '../assets/',
//     // 'style/main.css',
//     // 'images/still_life_medium.jpg',
//     // 'index.html',
//     // 'pages/offline.html',
//     // 'pages/404.html'
// ];

// const staticCacheName = 'pages-cache';

// self.addEventListener('install', event => {
//     console.log('Attempting to install service worker and cache static assets');
//     event.waitUntil(
//         caches.open(staticCacheName)
//         .then(cache => {
//         // return cache.addAll(filesToCache);
//         return cache.addAll([
//             '../src/test.js'
//         ]);
//         })
//     );
// });



// const cachename = "v1"; // Can be any string
// const cachedassets = ["index.html", "index.css", "script.js"];

// self.addEventListener("install", (e) => {
//     e.waitUntil(
//         caches
//         .open(cachename)
//         .then((cache) => {
//             cache.addAll(cachedassets)
//         })
//         .then(() => self.skipWaiting())
//     )
// })

// Call install event
// self.addEventListener("install", (e) => {
//     e.waitUntil(
//         caches
//         .open(cacheName)
//         .then((cache) =>
//                 cache.addAll(cachedAssets);
//             })
//         .then(() => self.skipWaiting())
//     );
// });