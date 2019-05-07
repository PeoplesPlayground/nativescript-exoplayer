import {Component, Input, OnInit} from '@angular/core';
import {registerElement} from 'nativescript-angular/element-registry';
import {Page} from 'tns-core-modules/ui/page';
import {Video} from '../videoplayer-common';

registerElement("exoplayer-view", () => require("../videoplayer-common").Video);

@Component({
    selector: "exoplayer",
    template: `
        <exoplayer-view id="nativeVideoPlayer" src="{{ manifest }}}" token="{{ token }}" height="280"></exoplayer-view>
    `,
})
export class NativescriptExoplayerComponent implements OnInit {
    videoPlayer: Video;
    manifest: string;
    token: string;
    constructor(private mainpage: Page) {}

    ngOnInit(): void {
        this.videoPlayer = this.mainpage.getViewById('nativeVideoPlayer') as Video;
        // console.log('NativescriptExoplayerComponent ngOnInit ' + this.videoPlayer);

        this.videoPlayer.subtitles = [];
        this.videoPlayer.autoplay = true;
    }
    @Input() set entitlement(value: any) {
        if (value && value.manifest) {
            this.manifest = value.manifest;
            this.token = value.token;
        }
    };
}
