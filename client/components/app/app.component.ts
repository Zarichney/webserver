import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  private messageSubscription!: Subscription;
  readonly id: string = uuidv4();
  private server!: WebsocketService;

  constructor(private websocketService: WebsocketService) { }

  ngOnInit(): void {

    const server = this.websocketService.Subscribe(this.id);

    server.On('someServerSideEventName', function (response: any) {
      console.log('App Component >> Response from server:', response);
    });
  }

  ngOnDestroy(): void {
    // this.websocketService.disconnect();
    // No need to manually unsubscribe here, the decorator will handle it
    // this.messageSubscription.unsubscribe();
  }

  public sendMessage(message: string): void {
    // this.websocketService.sendMessage(message);
  }
}
