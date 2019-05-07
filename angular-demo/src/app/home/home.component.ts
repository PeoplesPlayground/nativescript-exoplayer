import { Component, OnInit } from '@angular/core';
import {entitlement} from '../../entitlement';
import { isAndroid } from "tns-core-modules/platform";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  title = 'project-name';
  entitlement = {
      ...entitlement,
      manifest: isAndroid ? entitlement.dash : entitlement.hls
  };

  constructor() { }

  ngOnInit() {
  }
}
