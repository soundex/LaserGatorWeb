(function () {
  const reel = document.getElementById('featured-video');
  if (!reel) return;

  fetch('/data/media-manifest.json')
    .then((r) => r.json())
    .then((data) => {
      const videos = data.videos || [];
      if (!videos.length) return;

      const video = videos[0];
      reel.innerHTML = `
        <video muted autoplay loop playsinline
          ${video.poster ? `poster="/media/images/${video.poster}"` : ''}>
          <source src="/media/videos/${video.filename}" type="video/mp4">
        </video>`;
    })
    .catch(() => {});
})();
