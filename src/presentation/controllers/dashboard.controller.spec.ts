import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';

const mockEvents = [
  { eventType: 'UserRegistered', aggregateId: 'usr_001', status: 'consumed', traceId: 'trace_mock_001', topic: 'persistent://public/default/domain-events', timestamp: new Date().toISOString() },
  { eventType: 'UserLoggedIn', aggregateId: 'usr_001', status: 'consumed', traceId: 'trace_mock_002', topic: 'persistent://public/default/domain-events', timestamp: new Date().toISOString() },
  { eventType: 'OrderCreated', aggregateId: 'ord_001', status: 'consumed', traceId: 'trace_mock_003', topic: 'persistent://public/default/domain-events', timestamp: new Date().toISOString() },
  { eventType: 'OrderStatusChanged', aggregateId: 'ord_001', status: 'consumed', traceId: 'trace_mock_004', topic: 'persistent://public/default/domain-events', timestamp: new Date().toISOString() },
];

describe('DashboardController', () => {
  let controller: DashboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: 'EventBusPort',
          useValue: {
            publish: jest.fn(),
            subscribe: jest.fn(),
            getRecentEvents: jest.fn().mockReturnValue(mockEvents),
          },
        },
        {
          provide: 'CachePort',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getFlow', () => {
    it('should return architecture components', async () => {
      const result = await controller.getFlow();
      expect(result.components).toBeDefined();
      expect(result.components.length).toBe(8);
    });

    it('should include all required component types', async () => {
      const result = await controller.getFlow();
      const types = result.components.map((c) => c.type);
      expect(types).toContain('frontend');
      expect(types).toContain('backend');
      expect(types).toContain('auth');
      expect(types).toContain('database');
      expect(types).toContain('event-bus');
      expect(types).toContain('workflow');
    });

    it('should return data flows between components', async () => {
      const result = await controller.getFlow();
      expect(result.flows).toBeDefined();
      expect(result.flows.length).toBeGreaterThanOrEqual(8);

      for (const flow of result.flows) {
        expect(flow).toHaveProperty('from');
        expect(flow).toHaveProperty('to');
        expect(flow).toHaveProperty('label');
        expect(flow).toHaveProperty('protocol');
      }
    });

    it('should return recent events with traceId', async () => {
      const result = await controller.getFlow();
      expect(result.recentEvents).toBeDefined();
      expect(result.recentEvents.length).toBe(4);

      for (const event of result.recentEvents) {
        expect(event).toHaveProperty('eventType');
        expect(event).toHaveProperty('aggregateId');
        expect(event).toHaveProperty('status');
        expect(event).toHaveProperty('traceId');
        expect(event).toHaveProperty('topic');
        expect(event).toHaveProperty('timestamp');
      }
    });

    it('should include a timestamp', async () => {
      const result = await controller.getFlow();
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });

    it('should show core event types', async () => {
      const result = await controller.getFlow();
      const eventTypes = result.recentEvents.map((e) => e.eventType);
      expect(eventTypes).toContain('UserRegistered');
      expect(eventTypes).toContain('UserLoggedIn');
      expect(eventTypes).toContain('OrderCreated');
      expect(eventTypes).toContain('OrderStatusChanged');
    });
  });
});
