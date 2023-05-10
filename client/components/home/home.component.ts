import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import * as model from 'server/models';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  title: string;

  constructor(private dataService: ApiService) {
    this.title = "Home";
  }

  ngOnInit(): void {
    this.dataService.getTest().subscribe((data: model.MyModel[]) => {
      console.log("Test API Response:", data);

      // strongly typed
      let name = data[0].name;
      let varWithTypeDefined: string | undefined = name;
      let varWithTypeInferred = name;
    });
  }

}
