import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { WebsocketService } from '../../services/websocket.service';
import * as model from 'server/models';
import { WebsocketHelper } from '../../decorators/websocket.decorator';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
@WebsocketHelper()
export class HomeComponent implements OnInit {
  title: string;
  private server!: WebsocketService;

  constructor(private dataService: ApiService, private websocketService: WebsocketService) {
    this.title = "Home";
  }

  ngOnInit(): void {

    this.server.On('someServerSideEventName', function (response: any) {
      console.log('Home Component >> Response from server:', response);
    });

    this.dataService.getTest().subscribe((data: model.MyModel[]) => {
      console.log("Test API Response:", data);

      // strongly typed
      let name = data[0].name;
      let varWithTypeDefined: string | undefined = name;
      let varWithTypeInferred = name;
    });
  }

}
