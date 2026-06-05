# Symfony Standards

Detected via `symfony/framework-bundle` or `symfony/symfony` in `composer.json`. Target Symfony 7+.

## When to Use

- Enterprise PHP apps requiring strict architecture
- Need fine-grained component reuse (use individual Symfony components without full framework)
- Long-lived projects valuing stability + LTS support

Laravel is more popular for new apps; Symfony is more common in enterprise / legacy modernization. Both share components (Symfony powers many of Laravel's internals).

## Project Structure

```
src/
├── Controller/
├── Entity/                  # Doctrine ORM entities
├── Repository/
├── Service/
├── Form/
├── EventSubscriber/
└── DataFixtures/
config/
├── packages/                # Bundle configurations
├── routes.yaml
└── services.yaml             # DI container config
templates/                    # Twig templates
migrations/                   # Doctrine migrations
public/index.php              # Front controller
bin/console                   # CLI
```

## Routing — Attribute-based (Modern)

```php
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;

class UserController extends AbstractController
{
    #[Route('/users/{id}', name: 'user_show', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function show(int $id, UserRepository $users): Response
    {
        $user = $users->find($id) ?? throw $this->createNotFoundException();
        return $this->json(['id' => $user->getId(), 'email' => $user->getEmail()]);
    }

    #[Route('/users', methods: ['POST'])]
    public function create(#[MapRequestPayload] CreateUserDto $dto): Response
    {
        // ...
    }
}
```

Attributes (`#[Route]`) are the modern way — older YAML routing still works but is discouraged for new code.

## Dependency Injection

Symfony's DI container is the gold standard. Auto-wiring by type-hint:

```php
class UserService
{
    public function __construct(
        private UserRepository $repository,
        private LoggerInterface $logger,
        private EventDispatcherInterface $events,
    ) {}
}
```

Services are auto-registered from `src/`. Bindings configured in `config/services.yaml`:

```yaml
services:
    _defaults:
        autowire: true
        autoconfigure: true

    App\:
        resource: '../src/'
```

## Doctrine ORM

```php
#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: 'users')]
class User
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255, unique: true)]
    private string $email;

    #[ORM\OneToMany(targetEntity: Post::class, mappedBy: 'author')]
    private Collection $posts;

    public function __construct() { $this->posts = new ArrayCollection(); }
    public function getId(): ?int { return $this->id; }
    public function getEmail(): string { return $this->email; }
    public function setEmail(string $email): void { $this->email = $email; }
}
```

Repositories for queries:

```php
class UserRepository extends ServiceEntityRepository
{
    public function findActiveAdults(): array
    {
        return $this->createQueryBuilder('u')
            ->andWhere('u.age >= :age')
            ->setParameter('age', 18)
            ->getQuery()
            ->getResult();
    }
}
```

Migrations:
```bash
php bin/console make:entity
php bin/console make:migration
php bin/console doctrine:migrations:migrate
```

## Forms (Server-Rendered Apps)

```php
class UserType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('email', EmailType::class)
            ->add('name', TextType::class)
            ->add('save', SubmitType::class);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(['data_class' => User::class]);
    }
}
```

Mostly for traditional server-rendered apps. APIs use **API Platform** or **MapRequestPayload** with DTOs.

## Validation

```php
use Symfony\Component\Validator\Constraints as Assert;

class CreateUserDto
{
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Email]
        public string $email,

        #[Assert\NotBlank]
        #[Assert\Length(min: 8)]
        public string $password,
    ) {}
}
```

Inject `ValidatorInterface` to validate manually, or use `#[MapRequestPayload]` for auto-validation.

## Security

```yaml
# config/packages/security.yaml
security:
    password_hashers:
        Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface: 'auto'
    providers:
        app_user_provider:
            entity:
                class: App\Entity\User
                property: email
    firewalls:
        main:
            lazy: true
            provider: app_user_provider
            json_login:
                check_path: /api/login
            jwt: ~      # if using LexikJWT
    access_control:
        - { path: ^/api/admin, roles: ROLE_ADMIN }
```

## Console Commands

```php
#[AsCommand(name: 'app:send-emails')]
class SendEmailsCommand extends Command
{
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $io->info('Sending emails...');
        // ...
        return Command::SUCCESS;
    }
}
```

```bash
php bin/console app:send-emails
php bin/console list                # all commands
php bin/console make:command         # generate
```

## Events

```php
class UserRegisteredEvent extends Event
{
    public function __construct(public readonly User $user) {}
}

// Dispatch
$dispatcher->dispatch(new UserRegisteredEvent($user));

// Subscriber
#[AsEventListener(event: UserRegisteredEvent::class)]
class SendWelcomeEmail
{
    public function __invoke(UserRegisteredEvent $event): void
    {
        // ...
    }
}
```

## Messenger (Async / Bus)

```php
// Message
class SendEmail
{
    public function __construct(public string $to, public string $subject) {}
}

// Handler
#[AsMessageHandler]
class SendEmailHandler
{
    public function __invoke(SendEmail $msg): void
    {
        // ...
    }
}

// Dispatch
$bus->dispatch(new SendEmail('a@b.com', 'Hi'));
```

Use **Redis** or **Doctrine** as transport for production async. Workers:
```bash
php bin/console messenger:consume async --time-limit=3600
```

## API Platform

For REST/GraphQL APIs, **API Platform** sits on top of Symfony:

```php
#[ApiResource(operations: [new Get(), new GetCollection(), new Post(), new Patch(), new Delete()])]
#[ORM\Entity]
class Post { /* ... */ }
```

Auto-generates OpenAPI docs, hypermedia formats, pagination, filtering. Highly productive for CRUD APIs.

## Testing

```php
class UserControllerTest extends WebTestCase
{
    public function test_user_can_be_created(): void
    {
        $client = static::createClient();
        $client->request('POST', '/api/users', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['email' => 'a@b.com', 'password' => 'secret123']));

        $this->assertResponseStatusCodeSame(201);
        $this->assertJson($client->getResponse()->getContent());
    }
}
```

```bash
php bin/phpunit
```

Use **Doctrine transactional fixtures** to reset DB between tests.

## Best Practices

- **Type-hint everything** — Symfony auto-wires from types
- **DTOs + `#[MapRequestPayload]`** for input — clean separation from entities
- **Repositories** for all DB queries, never inline in controllers
- **Events** for cross-cutting concerns — decouples primary flow
- **Messenger** for any work > 100ms — async + retries built in
- **Read carefully**: `bin/console` shows hundreds of useful subcommands
- Enable **profiler** in dev (`/_profiler`) — invaluable for debugging perf

## Common Pitfalls

- Loading entities then iterating for related data → N+1; use JOIN FETCH
- Modifying entities without `$em->flush()` → no DB update
- Bypassing form/validation system → vulnerable to mass-assignment
- Putting logic in controllers → use services
- Forgetting `composer dump-autoload` after creating new classes (rare in modern Symfony but happens)
- Using `prod` environment in tests → cache contamination

## Resources

- Docs: https://symfony.com/doc/current
- Best practices: https://symfony.com/doc/current/best_practices.html
- Doctrine: https://www.doctrine-project.org
- API Platform: https://api-platform.com
- SymfonyCasts (tutorials): https://symfonycasts.com
