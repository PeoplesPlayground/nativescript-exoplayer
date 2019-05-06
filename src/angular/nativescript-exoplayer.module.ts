import { NgModule } from "@angular/core";
import { registerElement } from "nativescript-angular/element-registry";

@NgModule()
export class NativescriptExoplayerModule { }

registerElement("exoplayer", () => require("../videoplayer-common").Video);