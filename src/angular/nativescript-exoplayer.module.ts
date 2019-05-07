import { NgModule } from "@angular/core";
import {NativescriptExoplayerComponent} from './nativescript-exoplayer.component';
import {registerElement} from 'nativescript-angular/element-registry';
import { isAndroid } from "tns-core-modules/platform";

@NgModule({
    declarations: [NativescriptExoplayerComponent],
    exports: [NativescriptExoplayerComponent]
})
export class NativescriptExoplayerModule {
}

if (isAndroid) {
    registerElement("exoplayer-view", () => require("../videoplayer.android").Video);
} else {
    registerElement("exoplayer-view", () => require("../videoplayer.ios").Video);
}
