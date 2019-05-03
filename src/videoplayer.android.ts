﻿
import { Video as VideoBase, VideoFill, videoSourceProperty, tokenProperty } from "./videoplayer-common";
import * as nsUtils from "tns-core-modules/utils/utils";
import * as nsApp from "tns-core-modules/application";

export * from "./videoplayer-common";

declare const android: any, com: any;

// States from Exo Player
const STATE_IDLE: number = 1;
const STATE_BUFFERING: number = 2;
const STATE_READY: number = 3;
const STATE_ENDED: number = 4;

const SURFACE_WAITING: number = 0;
const SURFACE_READY: number = 1;

export class Video extends VideoBase {
	private _surfaceView: any; /// android.view.SurfaceView
	private _subtitlesView: any; /// com.google.android.exoplayer2.ui.SubtitleView
	private videoWidth: number;
	private videoHeight: number;
	private _src: any;
    private _token: any;
	private mediaState: number;
	private mediaPlayer: any;
	private mediaController: any;
	private preSeekTime: number;
	private _onReadyEmitEvent: Array<any>;
	private videoOpened: boolean;
	private eventPlaybackReady: boolean;
	private eventPlaybackStart: boolean;
	private lastTimerUpdate: number;
	private interval: number;
	private _suspendLocation: number;
	private _boundStart = this.resumeEvent.bind(this);
	private _boundStop = this.suspendEvent.bind(this);
	private enableSubtitles: boolean = true;
	private downloadCache: any;
	private downloadDirectory: any;

	public TYPE = {DETECT: 0, SS: 1, DASH: 2, HLS: 3, OTHER: 4};
	public nativeView: any;

	private drmSessionManager = null;
	private mediaDrm = null;

	constructor() {
		super();
		this._surfaceView = null;
		this.nativeView = null;
		this.videoWidth = 0;
		this.videoHeight = 0;
		this._onReadyEmitEvent = [];
		this._suspendLocation = null;

		this._src = null;

		this.mediaState = SURFACE_WAITING;
		this.mediaPlayer = null;
		this.mediaController = null;
		this.preSeekTime = -1;

		this.videoOpened = false;
		this.eventPlaybackReady = false;
		this.eventPlaybackStart = false;
		this.lastTimerUpdate = -1;
		this.interval = null;
    }

	get playState(): any {
		if (!this.mediaPlayer) {
			return STATE_IDLE;
		}
		return this.mediaPlayer.getPlaybackState();
	}

	get android(): any {
		return this.nativeView;
	}

	[videoSourceProperty.setNative](value) {
		this._setNativeVideo(value ? value.android : null);
	}

    [tokenProperty.setNative](value) {
        this._setNativeToken(value);
    }

	public createNativeView(): any {
		const nativeView = new android.widget.RelativeLayout(this._context);

        this._surfaceView = new android.view.SurfaceView(this._context);
        this._surfaceView.setSecure(true);
		this._surfaceView.setFocusable(true);
		this._surfaceView.setFocusableInTouchMode(true);
		this._surfaceView.requestFocus();
		nativeView.addView(this._surfaceView);

		if (this.enableSubtitles) {
			this._subtitlesView = new com.google.android.exoplayer2.ui.SubtitleView(this._context);
			this._subtitlesView.setUserDefaultStyle();
			this._subtitlesView.setUserDefaultTextSize();
            this._subtitlesView.setStyle(new com.google.android.exoplayer2.text.CaptionStyleCompat(
                0xffffffff,
                0x00000000,
                0x00000000,
                com.google.android.exoplayer2.text.CaptionStyleCompat.EDGE_TYPE_DROP_SHADOW,
                0xff000000,
                android.graphics.Typeface.DEFAULT));

			nativeView.addView(this._subtitlesView);

            // let params = this._subtitlesView.getLayoutParams();
            // params.addRule(14); // Center Horiz
            // params.addRule(12); // Align bottom
			//
            // this._subtitlesView.setLayoutParams(params);
		}


		return nativeView;
	}

	public initNativeView(): void {
		super.initNativeView();
		let that = new WeakRef(this);
		this._setupMediaController();
		this._surfaceView.setOnTouchListener(new android.view.View.OnTouchListener({
			get owner(): Video {
				return that.get();
			},
			onTouch: function (/* view, event */) {
				if (this.owner) {
					this.owner.toggleMediaControllerVisibility();
				}
				return false;
			}
		}));

		nsApp.on(nsApp.suspendEvent, this._boundStop);
		nsApp.on(nsApp.resumeEvent, this._boundStart);

	}

	public disposeNativeView() {
		this.disableEventTracking();
	}

	public disableEventTracking() {
		nsApp.off(nsApp.suspendEvent, this._boundStop);
		nsApp.off(nsApp.resumeEvent, this._boundStart);
	}

	public toggleMediaControllerVisibility(): void {
		if (!this.mediaController || !this.mediaPlayer) {
			return;
		}
		if (this.mediaController.isVisible()) {
			this.mediaController.hide();
		} else {
			this.mediaController.show();
		}
	}

	private _setupMediaPlayerListeners(): void {
		let that = new WeakRef(this);

		let vidListener = new com.google.android.exoplayer2.SimpleExoPlayer.VideoListener({
			get owner(): Video {
				return that.get();
			},
			onRenderedFirstFrame: function () {
				// Once the first frame has rendered it is ready to start playing...
				if (this.owner && !this.owner.eventPlaybackReady) {
					this.owner.eventPlaybackReady = true;
					this.owner._emit(VideoBase.playbackReadyEvent);
				}
			},
			onVideoSizeChanged: function (width, height /*, unappliedRotationDegrees, pixelWidthHeightRatio */) {
				if (this.owner) {
					this.owner.videoWidth = width;
					this.owner.videoHeight = height;
					if (this.owner.fill !== VideoFill.aspectFill) {
						this.owner._setupAspectRatio();
					}
				}
			}
		});
		let evtListener = new com.google.android.exoplayer2.ExoPlayer.EventListener({
			get owner(): Video {
				return that.get();
			},
			onLoadingChanged: function (/* isLoading */) {
				// Do nothing
			},
			onPlayerError: function (error) {
				console.error("PlayerError", error);
			},
			onPlayerStateChanged: function (playWhenReady, playbackState) {
				// console.log("OnPlayerStateChanged", playWhenReady, playbackState);
				if (!this.owner) {
					return;
				}

				// PlayBackState
				// 1 = IDLE
				// 2 = BUFFERING
				// 3 = Ready
				// 4 = Ended

				if (playbackState === STATE_READY) {

					// // We have to fire this from here in the event the textureSurface isn't set yet...
					// if (!this.owner.textureSurfaceSet && !this.owner.eventPlaybackReady) {
					// 	this.owner.eventPlaybackReady = true;
					// 	this.owner._emit(VideoBase.playbackReadyEvent);
					// }
					if (this.owner._onReadyEmitEvent.length) {
						do {
							this.owner._emit(this.owner._onReadyEmitEvent.shift());
						} while (this.owner._onReadyEmitEvent.length);
					}
					if (playWhenReady && !this.owner.eventPlaybackStart) {
						this.owner.eventPlaybackStart = true;
						// this.owner._emit(VideoBase.playbackStartEvent);
					}
				} else if (playbackState === STATE_ENDED) {
					if (!this.owner.loop) {
						this.owner.eventPlaybackStart = false;
						this.owner.stopCurrentTimer();
					}
					this.owner._emit(VideoBase.finishedEvent);
					if (this.owner.loop) {
						this.owner.play();
					}
				}

			},
			onPositionDiscontinuity: function () {
				// Do nothing
			},
			onSeekProcessed: function () {
				// Do nothing
			},
			onTimelineChanged: function (/* timeline, manifest */) {
				// Do nothing
			},
			onTracksChanged: function (/* trackGroups, trackSelections */) {
				// Do nothing
			}
		});
		this.mediaPlayer.setVideoListener(vidListener);
		this.mediaPlayer.addListener(evtListener);

	}

	private _setupMediaController(): void {
		if (this.controls !== false || this.controls === undefined) {
			if (this.mediaController == null) {
				this.mediaController = new com.google.android.exoplayer2.ui.PlaybackControlView(this._context);
				this.nativeView.addView(this.mediaController);

				let params = this.mediaController.getLayoutParams();
				params.addRule(14); // Center Horiz
				params.addRule(12); // Align bottom

				this.mediaController.setLayoutParams(params);
			} else {
				return;
			}
		}
	}

	private _setupAspectRatio(): void {

	}

	private _detectTypeFromSrc(uri: any): number {
		let type = com.google.android.exoplayer2.util.Util.inferContentType(uri);
		switch (type) {
			case 0:
				return this.TYPE.DASH;
			case 1:
				return this.TYPE.SS;
			case 2:
				return this.TYPE.HLS;
			default:
				return this.TYPE.OTHER;
		}
	}

	private _openVideo(): void {
		if (!(this._src && this._token)) {
			console.log("!src and token: " + this._src  + ", " + this._token);
			return;
		}
		this.release();

		if (!this.interval && this.observeCurrentTime) {
			this.startCurrentTimer();
		}

        // if (com.google.android.exoplayer2.util.Util.maybeRequestReadExternalStoragePermission(/* activity= */ this._context, [android.net.Uri.parse(this._src)])) {
        //     // The player will be reinitialized if the permission is granted.
        //     return;
        // }

		this.videoOpened = true; // we don't want to come back in here from texture system...

		let am = nsUtils.ad.getApplicationContext().getSystemService(android.content.Context.AUDIO_SERVICE);
		am.requestAudioFocus(null, android.media.AudioManager.STREAM_MUSIC, android.media.AudioManager.AUDIOFOCUS_GAIN);
		try {
			let bm = new com.google.android.exoplayer2.upstream.DefaultBandwidthMeter();
			let trackSelection = new com.google.android.exoplayer2.trackselection.AdaptiveTrackSelection.Factory(bm);
			let trackSelector = new com.google.android.exoplayer2.trackselection.DefaultTrackSelector(trackSelection);
			let loadControl = new com.google.android.exoplayer2.DefaultLoadControl();

			let drmLicenseUrl = "https://audienceplayer.keydelivery.westeurope.media.azure.net/Widevine/?kid=2c8b81cd-0278-4665-b2a2-17dd6a9fa575";
			let drmSchemeUuid = com.google.android.exoplayer2.util.Util.getDrmUuid("widevine");

            let licenseDataSourceFactory = new com.google.android.exoplayer2.upstream.DefaultHttpDataSourceFactory(com.google.android.exoplayer2.util.Util.getUserAgent(this._context, "ExoPlayerDemo"));
            let drmCallback = new com.google.android.exoplayer2.drm.HttpMediaDrmCallback(drmLicenseUrl, licenseDataSourceFactory);

            let token = this._token;

            drmCallback.setKeyRequestProperty("Authorization", "Bearer=" + token);

            if (this.mediaDrm != null) {
                this.mediaDrm.release();
                this.mediaDrm = null;
            }

            console.log("This far, using token: " + token);

            this.mediaDrm = com.google.android.exoplayer2.drm.FrameworkMediaDrm.newInstance(drmSchemeUuid);
            // DefaultDrmSessionManager<FrameworkMediaCrypto> drmSessionManager = null;
            this.drmSessionManager = new com.google.android.exoplayer2.drm.DefaultDrmSessionManager(drmSchemeUuid, this.mediaDrm, drmCallback, null, false);

            let renderersFactory = new com.google.android.exoplayer2.DefaultRenderersFactory(this._context, com.google.android.exoplayer2.DefaultRenderersFactory.EXTENSION_RENDERER_MODE_OFF);

            // this, renderersFactory, trackSelector, drmSessionManager
			this.mediaPlayer =
				com.google.android.exoplayer2.ExoPlayerFactory.newSimpleInstance(this._context, renderersFactory, trackSelector, this.drmSessionManager);

            this.mediaPlayer.setVideoSurfaceView(this._surfaceView);

			if (this.enableSubtitles) {
				//subtitles view
				this.mediaPlayer.setTextOutput(this._subtitlesView);
			}

			// let dsf = new com.google.android.exoplayer2.upstream.DefaultDataSourceFactory(this._context, "NativeScript", bm);
			let dsf = this.buildDataSourceFactory();
			let ef = new com.google.android.exoplayer2.extractor.DefaultExtractorsFactory();

			let vs, uri;
			if (this._src instanceof String || typeof this._src === "string") {
				uri = android.net.Uri.parse(this._src);

				const type = this._detectTypeFromSrc(this._src);
				switch (type) {
					case this.TYPE.SS:
						vs = new com.google.android.exoplayer2.source.smoothstreaming.SsMediaSource(uri, dsf,
							new com.google.android.exoplayer2.source.smoothstreaming.DefaultSsChunkSource.Factory(dsf), null, null);
						break;
					case this.TYPE.DASH:
                        console.log("TYPE.DASH...");

                        // vs = new com.google.android.exoplayer2.source.dash.DashMediaSource.Factory(dsf).setManifestParser(new com.google.android.exoplayer2.offline.FilteringManifestParser(new com.google.android.exoplayer2.source.dash.manifest.DashManifestParser(), null))
                        //     .createMediaSource(uri);

						vs = new com.google.android.exoplayer2.source.dash.DashMediaSource(uri, dsf,
							new com.google.android.exoplayer2.source.dash.DefaultDashChunkSource.Factory(dsf), null, null);
						break;
					case this.TYPE.HLS:
						vs = new com.google.android.exoplayer2.source.hls.HlsMediaSource(uri, dsf, null, null);
						break;
					default:
						vs = new com.google.android.exoplayer2.source.ExtractorMediaSource(uri, dsf, ef, null, null, null);
				}

				/* if (this.loop) {
					vs = new com.google.android.exoplayer2.source.LoopingMediaSource(vs);
				} */
			} else if (typeof this._src.typeSource === "number") {
				uri = android.net.Uri.parse(this._src.url);
				switch (this._src.typeSource) {
					case this.TYPE.SS:
						vs = new com.google.android.exoplayer2.source.smoothstreaming.SsMediaSource(uri, dsf,
							new com.google.android.exoplayer2.source.smoothstreaming.DefaultSsChunkSource.Factory(dsf), null, null);
						break;
					case this.TYPE.DASH:
						vs = new com.google.android.exoplayer2.source.dash.DashMediaSource(uri, dsf,
							new com.google.android.exoplayer2.source.dash.DefaultDashChunkSource.Factory(dsf), null, null);
						break;
					case this.TYPE.HLS:
						vs = new com.google.android.exoplayer2.source.hls.HlsMediaSource(uri, dsf, null, null);
						break;
					default:
						vs = new com.google.android.exoplayer2.source.ExtractorMediaSource(uri, dsf, ef, null, null, null);
				}

				/* if (this.loop) {
					vs = new com.google.android.exoplayer2.source.LoopingMediaSource(vs);
				} */


			} else {
				vs = this._src;
			}

			// subtitles src

            if (this.enableSubtitles) {
                try {
                	// this.subtitles
                    if (this.subtitles.length > 0 ) {
                        let mergedArray = (<any>Array).create(com.google.android.exoplayer2.source.MediaSource, this.subtitles.length + 1);
                        mergedArray[0] = vs;

                        this.subtitles.forEach((subtitle, i) => {
                            console.log("Set subtitle " + subtitle.src);
                            let subtitleUri = android.net.Uri.parse(subtitle.src.trim());

                            let textFormat = com.google.android.exoplayer2.Format.createTextSampleFormat(null, com.google.android.exoplayer2.util.MimeTypes.TEXT_VTT,
                                com.google.android.exoplayer2.Format.NO_VALUE, subtitle.lang);

                            let subtitlesSrc = new com.google.android.exoplayer2.source.SingleSampleMediaSource(
                                subtitleUri,
                                dsf,
                                textFormat,
                                com.google.android.exoplayer2.C.TIME_UNSET);

                            mergedArray[i + 1] = subtitlesSrc;
						});

                        vs = new com.google.android.exoplayer2.source.MergingMediaSource(mergedArray); //constructor is vararg
                    }
                } catch (ex) {
                    console.log("Error loading subtitles:", ex, ex.stack);
                }
            }

			if (this.mediaController) {
				this.mediaController.setPlayer(this.mediaPlayer);
			}

			this._setupMediaPlayerListeners();

			if (this.autoplay === true) {
			 	this.mediaPlayer.setPlayWhenReady(true);
			}
			if (this.preSeekTime > 0) {
				this.mediaPlayer.seekTo(this.preSeekTime);
				this.preSeekTime = -1;
			}

            console.log("before prepare 2");
            this.mediaPlayer.prepare(vs);

			this.mediaState = SURFACE_READY;

		} catch (ex) {
			console.log("Error:", ex, ex.stack);
		}
	}

	public _setNativeVideo(nativeVideo: any): void {
		this._src = nativeVideo;
		this._suspendLocation = 0;
		this._openVideo();
	}

    public _setNativeToken(token: any): void {
        this._token = token;
        this._suspendLocation = 0;
        this._openVideo();
    }

	public setNativeSource(nativePlayerSrc: string): void {
		this._src = nativePlayerSrc;
		this._suspendLocation = 0;
		this._openVideo();
	}

	public play(): void {
		if (!this.mediaPlayer || this.mediaState === SURFACE_WAITING) {
			this._openVideo();
		} else if (this.playState === STATE_ENDED) {
			this.eventPlaybackStart = false;
			this.mediaPlayer.seekToDefaultPosition();
			this.startCurrentTimer();
		} else {
			this.mediaPlayer.setPlayWhenReady(true);
			this.startCurrentTimer();
		}
	}

	public pause(): void {
		if (this.mediaPlayer) {
			this.mediaPlayer.setPlayWhenReady(false);
		}
	}

	public mute(mute: boolean): void {
		if (this.mediaPlayer) {
			if (mute === true) {
				this.mediaPlayer.setVolume(0);
			} else if (mute === false) {
				this.mediaPlayer.setVolume(1);
			}
		}
	}

	public stop(): void {
		if (this.mediaPlayer) {
			this.stopCurrentTimer();
			this.mediaPlayer.stop();
			this.release();
		}
	}

	private _addReadyEvent(value: any) {
		if (this._onReadyEmitEvent.indexOf(value)) {
			return;
		}
		this._onReadyEmitEvent.push(value);
	}

	public seekToTime(ms: number): void {
		this._addReadyEvent(VideoBase.seekToTimeCompleteEvent);

		if (!this.mediaPlayer) {
			this.preSeekTime = ms;
			return;
		} else {
			this.preSeekTime = -1;
		}
		this.mediaPlayer.seekTo(ms);
	}

	public isPlaying(): boolean {
		if (!this.mediaPlayer) {
			return false;
		}
		if (this.playState === STATE_READY) {
			return this.mediaPlayer.getPlayWhenReady();
		}
		return false;
	}

	public getDuration(): number {
		if (!this.mediaPlayer || this.mediaState === SURFACE_WAITING || this.playState === STATE_IDLE) {
			return 0;
		}
		let duration = this.mediaPlayer.getDuration();
		if (isNaN(duration)) {
			return 0;
		} else {
			return duration;
		}
	}

	public getCurrentTime(): number {
		if (!this.mediaPlayer) {
			return 0;
		}
		return this.mediaPlayer.getCurrentPosition();
	}

	public setVolume(volume: number) {
		if (this.mediaPlayer) {
			this.mediaPlayer.setVolume(volume);
		}
	}

	public destroy() {
		this.release();
		this.src = null;
		this._surfaceView = null;
		this.mediaPlayer = null;
		this.mediaController = null;
	}

	private release(): void {
		this.stopCurrentTimer();
		this.videoOpened = false;
		this.eventPlaybackReady = false;
		this.eventPlaybackStart = false;

		if (this.mediaPlayer !== null) {
			this.mediaState = SURFACE_WAITING;
			this.mediaPlayer.release();
			this.mediaPlayer = null;
			if (this.mediaController && this.mediaController.isVisible()) {
				this.mediaController.hide();
			}
			let am = nsUtils.ad.getApplicationContext().getSystemService(android.content.Context.AUDIO_SERVICE);
			am.abandonAudioFocus(null);
		}
	}

	public suspendEvent(): void {
		this._suspendLocation = this.getCurrentTime();
		this.release();
	}

	public resumeEvent(): void {
		if (this._suspendLocation) {
			this.seekToTime(this._suspendLocation);
			this._suspendLocation = 0;
		}
		this._openVideo();
	}

	private startCurrentTimer(): void {
		if (this.interval) {
			return;
		}
		this.lastTimerUpdate = -1;
		this.interval = <any>setInterval(() => {
			this.fireCurrentTimeEvent();
		}, 200);
	}

	private fireCurrentTimeEvent(): void {
		if (!this.mediaPlayer) {
			return;
		}
		let curTimer = this.mediaPlayer.getCurrentPosition();
		if (curTimer !== this.lastTimerUpdate) {
			this.notify({
				eventName: VideoBase.currentTimeUpdatedEvent,
				object: this,
				position: curTimer
			});
			this.lastTimerUpdate = curTimer;
		}
	}

	private stopCurrentTimer(): void {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
		this.fireCurrentTimeEvent();
	}

    private buildDataSourceFactory() {
        // const upstreamFactory = new com.google.android.exoplayer2.upstream.DefaultDataSourceFactory(this._context, new com.google.android.exoplayer2.upstream.DefaultHttpDataSourceFactory(com.google.android.exoplayer2.util.Util.getUserAgent(this._context, "ExoPlayerDemo")));
        // return this.buildReadOnlyCacheDataSource(upstreamFactory, this.getDownloadCache());
        //
        return new com.google.android.exoplayer2.upstream.DefaultDataSourceFactory(this._context, "NativeScript");
    }


    private buildReadOnlyCacheDataSource(upstreamFactory, cache) {
		return new com.google.android.exoplayer2.upstream.cache.CacheDataSourceFactory(cache, upstreamFactory, new com.google.android.exoplayer2.upstream.FileDataSourceFactory(),
		/* cacheWriteDataSinkFactory= */ null,
            com.google.android.exoplayer2.upstream.cache.CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR,
		/* eventListener= */ null);
	}

	private getDownloadCache() {
		if (this.downloadCache == null) {
			let downloadContentDirectory = new java.io.File(this.getDownloadDirectory(), "downloads");
			this.downloadCache = new com.google.android.exoplayer2.upstream.cache.SimpleCache(downloadContentDirectory, new com.google.android.exoplayer2.upstream.cache.NoOpCacheEvictor());
		}
		return this.downloadCache;
	}

	private getDownloadDirectory() {
		if (this.downloadDirectory == null) {
			this.downloadDirectory = this._context.getExternalFilesDir(null);
			if (this.downloadDirectory == null) {
				this.downloadDirectory = this._context.getFilesDir();
			}
		}
		return this.downloadDirectory;
	}


}
