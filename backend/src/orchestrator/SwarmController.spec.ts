import { SwarmController } from './SwarmController';
import Pulsar from 'pulsar-client';

// Mock pulsar-client
jest.mock('pulsar-client', () => {
    return {
        Client: jest.fn().mockImplementation(() => ({
            createProducer: jest.fn().mockResolvedValue({
                send: jest.fn(),
                close: jest.fn().mockResolvedValue(undefined),
            }),
            close: jest.fn().mockResolvedValue(undefined),
        })),
    };
});

describe('SwarmController', () => {
    let controller: SwarmController;
    let mockClient: any;
    let mockProducer: any;

    beforeEach(async () => {
        // Reset mocks
        jest.clearAllMocks();

        controller = new SwarmController();

        // Initialize to trigger client/producer creation
        // Accessing private mock objects for assertion locally would require casting or better verification
        // But for this spec we can verify interactions via the mocked module
    });

    it('should initialize Pulsar client on creation', () => {
        expect(Pulsar.Client).toHaveBeenCalledTimes(1);
    });

    it('should create a producer when spawning a swarm', async () => {
        await controller.spawnSwarm('Test Goal', 1);

        // Get the mock client instance
        const clientInstance = (Pulsar.Client as unknown as jest.Mock).mock.instances[0];
        expect(clientInstance.createProducer).toHaveBeenCalledTimes(1);
        expect(clientInstance.createProducer).toHaveBeenCalledWith(expect.objectContaining({
            topic: expect.any(String)
        }));
    });

    it('should dispatch tasks to the producer', async () => {
        await controller.spawnSwarm('Test Goal', 2);

        // Access the producer mock from the client instance
        const clientInstance = (Pulsar.Client as unknown as jest.Mock).mock.instances[0];
        // Wait for promise to resolve since createProducer is async in our mock
        const producer = await clientInstance.createProducer.mock.results[0].value;

        // Should have sent 2 messages (one for each subtask)
        expect(producer.send).toHaveBeenCalledTimes(2);

        const firstCallArg = producer.send.mock.calls[0][0];
        const data = JSON.parse(firstCallArg.data.toString());

        expect(data).toMatchObject({
            type: 'TASK_ASSIGNMENT',
            task: expect.stringContaining('Subtask 1'),
        });
    });

    it('should close client and producer on cleanup', async () => {
        await controller.initialize();
        await controller.close();

        const clientInstance = (Pulsar.Client as unknown as jest.Mock).mock.instances[0];
        const producer = await clientInstance.createProducer.mock.results[0].value;

        expect(producer.close).toHaveBeenCalled();
        expect(clientInstance.close).toHaveBeenCalled();
    });
});
