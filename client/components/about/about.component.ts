import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {
  title: string;
  updatedtitle: string | undefined;

  constructor(private route: ActivatedRoute) {
    this.title = route.snapshot.data['title'] + "snapshot";
  }
  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.updatedtitle = data['title'] + "subscribed";
    });
  }

}
