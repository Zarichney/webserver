import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import { v4 as uuidv4 } from 'uuid';
import { AutoUnsubscribe } from '../../decorators/unsubscribe.decorator';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
@AutoUnsubscribe('messageSubscription')
export class AppComponent implements OnInit, OnDestroy {
  private messageSubscription!: Subscription;
  readonly id: string = uuidv4();

  constructor(private websocketService: WebsocketService) { }

  ngOnInit(): void {

    this.websocketService.Subscribe(this.id);

    this.messageSubscription = this.websocketService.getMessages().subscribe(data => {
      console.log('new message received from server', data);
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
