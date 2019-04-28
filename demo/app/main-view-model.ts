import { Observable } from "tns-core-modules/data/observable";
import { Page } from "tns-core-modules/ui/page";
import { isAndroid } from "tns-core-modules/platform";
import { setInterval } from "tns-core-modules/timer";
import { VideoFill } from "nativescript-exoplayer";

export class HelloWorldModel extends Observable {
  public videoSrc: string;
  public token: string;
  public subtitlesSrc: string;
  public currentTime: any;
  public videoDuration: any;
  public videoFill: VideoFill = VideoFill.default;
  private _videoPlayer: any;
  private completed: boolean;

  constructor(mainpage: Page) {
    super();

    this.completed = false;
    this._videoPlayer = <any>mainpage.getViewById("nativeVideoPlayer");
    this.currentTime = "";
    this.videoDuration = "";
    // this.videoSrc = "~/videos/big_buck_bunny.mp4";
    this.videoSrc = "https://audienceplayer.streaming.mediaservices.windows.net/1e557078-4a47-4d05-b7ef-f4b3bc2a86a9/dip-en-dap-pannenkoeken-eten.ism/manifest(format=mpd-time-csf,encryption=cenc).mpd";
    this.token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOlwvXC9jb3JlLmF1ZGllbmNlcGxheWVyLmNvbSIsImF1ZCI6Imh0dHA6XC9cL2NvcmUuYXVkaWVuY2VwbGF5ZXIuY29tIiwibmJmIjoxNTU2MzY5OTg2LCJleHAiOjE1NTYzNzExODYsInVybjptaWNyb3NvZnQ6YXp1cmU6bWVkaWFzZXJ2aWNlczpjb250ZW50a2V5aWRlbnRpZmllciI6IjJjOGI4MWNkLTAyNzgtNDY2NS1iMmEyLTE3ZGQ2YTlmYTU3NSJ9.iwzxdT5C9mXmx2MPWI4OCOS-KpwTi7-RNTr-cF28rCc";
    this.subtitlesSrc = "~/videos/sample.srt";
    this.trackVideoCurrentPosition();
  }

  public setEnglishSubtitles() {
    this._videoPlayer.subtitles = "~/videos/sample.srt";
  }

  public setRussianSubtitles() {
    this._videoPlayer.subtitles = "~/videos/sample-ru.srt";
  }

  public disableSubtitles() {
    this._videoPlayer.subtitles = "";
  }

  /**
   * Video Finished callback
   */
  public videoFinished(args) {
    this.completed = true;
  }

  public playbackStart(args) {
  	this.completed = false;
  }

  /**
   * Pause the video
   */
  public pauseVideo() {
    this._videoPlayer.pause();
  }


  /**
   * Play the video
   */
  public playVideo() {
    this._videoPlayer.play();
    this.completed = false;
  }


  /**
   * Stop the video player
   */
  public stopVideo() {
    if (isAndroid) {
      this._videoPlayer.stop();
    }
  }


  /**
   * Get the video duration
   */
  public getVideoDuration() {
    let videoDuration = this._videoPlayer.getDuration();
    console.log("Video Duration: " + videoDuration);
    this.set("videoDuration", videoDuration);
  }


  /**
   * Go to 30 seconds
   */
  public goToTime() {
    try {
      this._videoPlayer.seekToTime(30000);
    } catch (err) {
      console.log(err);
    }
  }


  public animate() {
    console.log("Animation");

    const enums = require("tns-core-modules/ui/enums");
    this._videoPlayer.animate({
      rotate: 360,
      duration: 3000,
      curve: enums.AnimationCurve.spring
    }).then(() => {
      return this._videoPlayer.animate({
        rotate: 0,
        duration: 3000,
        curve: enums.AnimationCurve.spring
      });
    }).then(() => {
      return this._videoPlayer.animate({
        scale: { x: .5, y: .5 },
        duration: 1000,
        curve: enums.AnimationCurve.spring
      });

    }).then(() => {
      return this._videoPlayer.animate({
        scale: { x: 1.5, y: 1.5 },
        duration: 3000,
        curve: enums.AnimationCurve.spring
      });
    }).then(() => {
      return this._videoPlayer.animate({
        scale: { x: 1.0, y: 1.0 },
        duration: 3000,
        curve: enums.AnimationCurve.spring
      });

    });

  }

  public muteVideo() {
    this._videoPlayer.mute(true);
  }

  public unmuteVideo() {
    this._videoPlayer.mute(false);
  }


  /**
   * Get the video current time
   */
  public getVideoCurrentTime() {
    try {
      let currentTime = this._videoPlayer.getCurrentTime();
      console.log("Current Time: " + currentTime);
    } catch (err) {
      console.log(err);
    }
  }



  /**
   * Change the video src property
   */
  public changeVideoSource() {
    //  this._videoPlayer.src = "~/videos/test_video_rotated.mp4";
    //  return;

    if (this.videoSrc === "~/videos/small.mp4") {
      this._videoPlayer.src = "https://clips.vorwaerts-gmbh.de/big_buck_bunny.mp4";
    } else {
      this._videoPlayer.src = "~/videos/small.mp4";
    }
  }



  private trackVideoCurrentPosition(): number {
    let trackInterval = setInterval(() => {
      let x, y;
      if (this.completed) {
        x = "";
        y = "";
      } else {
        x = this._videoPlayer.getCurrentTime();
        y = this._videoPlayer.getDuration();
      }
      this.set("currentTime", x);
      this.set("videoDuration", y);
    }, 200);
    return trackInterval;

  }


}