import {Component, Input, OnInit} from '@angular/core';
import {Page} from 'tns-core-modules/ui/page';
import {Video} from '../videoplayer-common';

@Component({
    selector: "exoplayer",
    template: `
        <exoplayer-view id="nativeVideoPlayer" src="{{ manifest }}}" token="{{ token }}" height="280"></exoplayer-view>
    `,
})
export class NativescriptExoplayerComponent implements OnInit {
    videoPlayer: Video = null;
    manifest: string;
    token: string;
    _entitlement: any = null;
    constructor(private mainpage: Page) {}

    ngOnInit(): void {
        this.videoPlayer = this.mainpage.getViewById('nativeVideoPlayer') as Video;
        console.log('NativescriptExoplayerComponent ngOnInit ' + this.videoPlayer);

        this.videoPlayer.subtitles = [];
        this.videoPlayer.autoplay = true;

        this.updateEntitlement();

    }
    @Input() set entitlement(value: any) {
        if (value && value.manifest) {
            console.log('entitlement ' + JSON.stringify(value));
            this.manifest = value.manifest;
            this.token = value.token;
            this._entitlement = value;
            this.updateEntitlement();
        }
    };


    protected updateEntitlement() {
        if (this._entitlement && this.videoPlayer) {
            console.log("updated");
            this.videoPlayer.drmLicenseUrl = this._entitlement.drmLicenseUrl;
            this.videoPlayer.subtitles = this._entitlement.subtitles;
        }
    }
}
